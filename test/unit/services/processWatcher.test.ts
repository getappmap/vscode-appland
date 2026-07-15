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

// To be tested
import {
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';

const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

function makeWatcher(opts: Partial<ProcessWatcherOptions> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ProcessWatcher(new MockExtensionContext(), {
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

  describe('loadEnvironment', () => {
    let context: vscode.ExtensionContext;
    beforeEach(() => {
      context = new MockExtensionContext();
    });

    describe('without OpenAI API key', () => {
      it('propagates the APPMAP_API_KEY', async () => {
        const env = await processWatcher.loadEnvironment(context);
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
  });
});
