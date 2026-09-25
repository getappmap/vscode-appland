import '../mock/vscode';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import Sinon from 'sinon';
import { expect } from 'chai';
import assert from 'node:assert';
import { isNativeError } from 'node:util/types';
import { join } from 'path';
import ps from 'ps-node';
import sinon from 'sinon';
import { promisify } from 'util';
import type vscode from 'vscode';

// To be stubbed
import * as processWatcher from '../../../src/services/processWatcher';
import * as nodeDependencyProcess from '../../../src/services/nodeDependencyProcess';
import { setSecretEnvVars } from '../../../src/services/navieConfigurationService';
import * as authentication from '../../../src/authentication';
import { clearCustomerId, setCustomerId } from '../../../src/configuration/customerId';

// To be tested
import {
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';
import { wait, waitFor } from '../../waitFor';

const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

function makeWatcher(
  opts: Partial<ProcessWatcherOptions> = {},
  context: vscode.ExtensionContext = new MockExtensionContext()
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ProcessWatcher(context, {
    id: 'test process' as unknown as ProcessId,
    modulePath: testModule,
    binPath: 'unused',
    cwd: '.',
    ...opts,
  });
}

describe('ProcessWatcher', () => {
  // If the API key is not present, the process will not be enabled.
  beforeEach(() => Sinon.stub(authentication, 'getApiKey').resolves('the-appmap-key'));
  afterEach(() => Sinon.restore());

  describe('stop', () => {
    it('does not send error event', async () => {
      const watcher = makeWatcher();
      let errorReceived: undefined | Error;
      watcher.onError((error) => (errorReceived = error));

      await watcher.start();
      await watcher.stop();

      expect(errorReceived).to.be.undefined;
    });

    it('waits for the process to finish', async () => {
      const watcher = makeWatcher();
      await watcher.start();
      const { process } = watcher;

      assert(process);

      expect(await promisify(ps.lookup)({ pid: process.pid })).to.not.be.empty;

      await watcher.stop();

      expect(await promisify(ps.lookup)({ pid: process.pid })).to.be.empty;
    }).timeout(10000);

    context('with fake times', () => {
      let clock: sinon.SinonFakeTimers;

      beforeEach(() => (clock = sinon.useFakeTimers()));
      afterEach(() => clock.restore());

      it('kills the process forcefully if needed', async () => {
        const watcher = makeWatcher();
        await watcher.start();
        const { process } = watcher;

        assert(process);

        expect(await promisify(ps.lookup)({ pid: process.pid })).to.not.be.empty;

        const stop = watcher.stop();
        clock.runAll();
        await stop;

        expect(await promisify(ps.lookup)({ pid: process.pid })).to.be.empty;
      }).timeout(10000);
    });
  });

  describe('start', () => {
    it('shares a single spawn across concurrent calls instead of doing redundant work', async () => {
      const spawnSpy = Sinon.spy(nodeDependencyProcess, 'spawn');
      const watcher = makeWatcher();

      // Deliberately not awaited: both calls should observe this.process as undefined
      // while the first is still awaiting loadEnvironment(), and share the same in-flight
      // start rather than each independently spawning and re-fetching credentials/env.
      const start1 = watcher.start();
      const start2 = watcher.start();

      await Promise.all([start1, start2]);

      expect(spawnSpy.callCount).to.equal(1);
      assert(watcher.process);

      await watcher.stop();
    }).timeout(10000);

    // The window is real: loadEnvironment() reads the API key out of secret storage, and
    // stop() looks at this.process, which a start in flight has not set yet. It therefore
    // finds nothing to kill, and the spawn that follows outlives the stop that was meant to
    // prevent it.
    it('spawns nothing if stopped while assembling the environment', async () => {
      const spawnSpy = Sinon.spy(nodeDependencyProcess, 'spawn');
      const watcher = makeWatcher();

      const starting = watcher.start();
      await watcher.stop();
      await starting;

      expect(watcher.running).to.be.false;
      expect(spawnSpy.callCount).to.equal(0);
    }).timeout(10000);

    it('leaves nothing running if disposed while assembling the environment', async () => {
      const spawnSpy = Sinon.spy(nodeDependencyProcess, 'spawn');
      const watcher = makeWatcher();

      const starting = watcher.start();
      watcher.dispose();
      await starting;

      for (const spawned of spawnSpy.returnValues) {
        expect(await promisify(ps.lookup)({ pid: spawned.pid })).to.be.empty;
      }
    }).timeout(10000);

    // Starting again after a stop is a different matter: the stop is complete, so the start
    // has to do its work rather than inherit the abandoned one.
    it('starts again after a stop', async () => {
      const watcher = makeWatcher();

      const starting = watcher.start();
      await watcher.stop();
      await starting;
      await watcher.start();

      expect(watcher.running).to.be.true;

      await watcher.stop();
    }).timeout(10000);
  });

  // What the watcher reports, and what it restarts, both follow from whether we asked for the
  // exit -- never from how the process happened to die.
  describe('on an exit nobody asked for', () => {
    // Retries are what the test is waiting on, so don't sit through the real backoff.
    const retries = { retryTimes: 2, retryBackoff: () => 1 };

    function collect(watcher: ProcessWatcher) {
      const errors: Error[] = [];
      const aborts: Error[] = [];
      watcher.onError((e) => errors.push(e));
      watcher.onAbort((e) => aborts.push(e));
      return { errors, aborts };
    }

    // Waits for the restart before stopping: a stop that lands while the watcher is backing
    // off is a race of its own, and it would leave this test's process behind.
    async function killAndRestart(watcher: ProcessWatcher, signal: NodeJS.Signals) {
      await watcher.start();
      const killed = watcher.process;
      assert(killed);

      killed.kill(signal);
      await waitFor(
        'the process to be restarted',
        () => watcher.process !== undefined && watcher.process.pid !== killed.pid
      );

      return killed;
    }

    it('reports a signal the same as an exit status', async () => {
      const watcher = makeWatcher(retries);
      const { errors } = collect(watcher);

      await killAndRestart(watcher, 'SIGKILL');

      expect(errors).to.have.lengthOf(1);
      expect(errors[0].message).to.include('exited with signal SIGKILL');

      await watcher.stop();
    }).timeout(10000);

    // SIGTERM reads as a polite request to go away, but it says nothing about who made it.
    // Only a stop() we issued ourselves means the process should stay down.
    it('restarts after a SIGTERM it did not ask for', async () => {
      const watcher = makeWatcher(retries);

      const killed = await killAndRestart(watcher, 'SIGTERM');
      expect(watcher.process?.pid).to.not.equal(killed.pid);

      await watcher.stop();
    }).timeout(10000);

    // Four identical exceptions per incident is what this looked like in the field.
    it('reports the first failure of a run of crashes, then the abort', async () => {
      const watcher = makeWatcher({ ...retries, args: ['exit', '1'] });
      const { errors, aborts } = collect(watcher);

      await watcher.start();
      await waitFor('the watcher to give up', () => aborts.length > 0);

      expect(errors).to.have.lengthOf(1);
      expect(errors[0].message).to.include('exited with code 1');
      expect(aborts[0].message).to.include('crashed too many times');
    }).timeout(10000);

    // A watch-mode daemon that returns 0 has stopped watching, which is no less a failure
    // than crashing: indexing silently stops either way.
    it('reports a clean exit too', async () => {
      const watcher = makeWatcher({ ...retries, args: ['exit', '0'] });
      const { errors, aborts } = collect(watcher);

      // Settling on the abort rather than the first error leaves nothing running behind.
      await watcher.start();
      await waitFor('the watcher to give up', () => aborts.length > 0);

      expect(errors[0].message).to.include('exited with code 0');
    }).timeout(10000);
  });

  // A crash schedules a retry that comes back a backoff later. By then the watcher may have
  // been stopped and started again, and the process it was retrying is no longer the one the
  // watcher owns.
  describe('a retry that comes back after a restart', () => {
    // Long enough that the restart below is comfortably finished before the retry resumes;
    // otherwise the retry sees the stop rather than the replacement, and proves nothing.
    const backoff = 300;

    // stop() removes the exit listener but not the error one, so a process the watcher has
    // let go of can still report a failure late. The crash counter it would land on belongs
    // to whatever is running now: spending it costs the replacement a retry, suppresses the
    // report of its first crash, and -- once it tips over retryTimes -- aborts the watcher
    // over a process that is running perfectly well.
    it('ignores a failure from a process it has already replaced', async () => {
      const watcher = makeWatcher({ retryTimes: 1, retryBackoff: () => 1 });
      const aborts: Error[] = [];
      watcher.onAbort((e) => aborts.push(e));

      await watcher.start();
      const first = watcher.process;
      assert(first);
      first.kill('SIGKILL');

      await waitFor(
        'the process to be restarted',
        () => watcher.process !== undefined && watcher.process.pid !== first.pid
      );
      const replacement = watcher.process;
      const spent = watcher.crashCount;

      first.emit('error', new Error('a late word from the process we replaced'));

      expect(watcher.crashCount).to.equal(spent);
      expect(aborts).to.be.empty;
      expect(watcher.process?.pid).to.equal(replacement?.pid);

      await watcher.stop();
    }).timeout(10000);

    it('does not spawn alongside the replacement', async () => {
      const spawnSpy = Sinon.spy(nodeDependencyProcess, 'spawn');
      const watcher = makeWatcher({ retryBackoff: () => backoff });
      const failures: Error[] = [];
      watcher.onError((e) => failures.push(e));

      await watcher.start();
      const crashed = watcher.process;
      assert(crashed);
      crashed.kill('SIGKILL');

      // Wait for the exit to be noticed, or the restart below removes the exit listener
      // before it fires and no retry is ever scheduled -- nothing to race with.
      await waitFor('the crash to be noticed', () => failures.length > 0);

      await watcher.restart();
      const replacement = watcher.process;
      assert(replacement);

      // The assertion is that the stale retry does nothing, so there is nothing to wait on
      // but the backoff itself.
      await wait(backoff * 4);

      expect(watcher.process?.pid).to.equal(replacement.pid);
      for (const spawned of spawnSpy.returnValues) {
        if (spawned.pid === replacement.pid) continue;
        expect(await promisify(ps.lookup)({ pid: spawned.pid }), `pid ${spawned.pid}`).to.be.empty;
      }

      await watcher.stop();
    }).timeout(10000);
  });

  describe('dispose', () => {
    it('prevents the watcher from being started', async () => {
      const watcher = makeWatcher();
      watcher.dispose();

      let error: Error | undefined;
      try {
        await watcher.start();
      } catch (e) {
        assert(isNativeError(e));
        error = e;
      }

      assert(error);
      expect(error.message).to.include('disposed');
    });
  });

  // The indexer and scanner are started and stopped by polling canStart() once a second, so
  // an entitled installation that is not signed in must report enabled here or those services
  // never run at all.
  describe('canStart', () => {
    const configuredDir = join(__dirname, '..', '..', 'fixtures', 'workspaces', 'project-base');

    let context: MockExtensionContext;

    beforeEach(() => {
      context = new MockExtensionContext();
    });

    afterEach(() => clearCustomerId(context));

    function watcher() {
      return makeWatcher({ cwd: configuredDir }, context);
    }

    it('is enabled with a session', async () => {
      expect(await watcher().canStart()).to.deep.equal({ enabled: true });
    });

    it('is disabled without a session and without a customer ID', async () => {
      (authentication.getApiKey as Sinon.SinonStub).resolves(undefined);

      expect(await watcher().canStart()).to.deep.equal({
        enabled: false,
        reason: 'User is not logged in to AppMap',
      });
    });

    it('is enabled when entitled without a session', async () => {
      (authentication.getApiKey as Sinon.SinonStub).resolves(undefined);
      await setCustomerId(context, 'acme-corp', 'orgConfig');

      expect(await watcher().canStart()).to.deep.equal({ enabled: true });
    });

    it('is still disabled when the directory is not configured, entitled or not', async () => {
      await setCustomerId(context, 'acme-corp', 'orgConfig');

      const { enabled, reason } = await makeWatcher({ cwd: __dirname }, context).canStart();

      expect(enabled).to.be.false;
      expect(reason).to.include('is not configured');
    });
  });

  describe('loadEnvironment', () => {
    let context: vscode.ExtensionContext;
    beforeEach(() => {
      context = new MockExtensionContext();
    });

    afterEach(() => clearCustomerId(context));

    describe('without OpenAI API key', () => {
      it('propagates the APPMAP_API_KEY', async () => {
        const env = await processWatcher.loadEnvironment(context);
        expect(env).to.have.property('APPMAP_API_KEY', 'the-appmap-key');
        expect(env).to.not.have.property('OPENAI_API_KEY');
      });
    });

    describe('with OpenAI API key', () => {
      beforeEach(() => setSecretEnvVars(context, { OPENAI_API_KEY: 'the-openai-key' }));

      it('propagates the OPENAI_API_KEY', async () => {
        const env = await processWatcher.loadEnvironment(context);
        expect(env).to.have.property('OPENAI_API_KEY', 'the-openai-key');
      });
    });

    describe('without a session', () => {
      beforeEach(() => (authentication.getApiKey as Sinon.SinonStub).resolves(undefined));

      it('omits the APPMAP_API_KEY rather than passing an empty one', async () => {
        const env = await processWatcher.loadEnvironment(context);
        expect(env).to.not.have.property('APPMAP_API_KEY');
      });

      it('passes the customer ID in place of it when entitled', async () => {
        await setCustomerId(context, 'acme-corp', 'orgConfig');

        const env = await processWatcher.loadEnvironment(context);

        expect(env).to.have.property('APPMAP_CUSTOMER_ID', 'acme-corp');
        expect(env).to.not.have.property('APPMAP_API_KEY');
      });
    });

    describe('with a session', () => {
      it('omits the customer ID when there is none', async () => {
        const env = await processWatcher.loadEnvironment(context);
        expect(env).to.not.have.property('APPMAP_CUSTOMER_ID');
      });

      // The API key wins for authentication; the customer ID is attribution-only.
      it('passes both when a customer ID is also set', async () => {
        await setCustomerId(context, 'acme-corp', 'orgConfig');

        const env = await processWatcher.loadEnvironment(context);

        expect(env).to.have.property('APPMAP_API_KEY', 'the-appmap-key');
        expect(env).to.have.property('APPMAP_CUSTOMER_ID', 'acme-corp');
      });
    });
  });
});
