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
import { setSecretEnvVars } from '../../../src/services/navieConfigurationService';
import * as authentication from '../../../src/authentication';
import { clearCustomerId, setCustomerId } from '../../../src/configuration/customerId';

// To be tested
import {
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';

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
