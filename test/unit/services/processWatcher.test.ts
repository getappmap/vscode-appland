import '../mock/vscode';
import Sinon from 'sinon';
import { expect } from 'chai';
import assert from 'node:assert';
import { join } from 'path';
import ps from 'ps-node';
import sinon from 'sinon';
import { promisify } from 'util';
import type vscode from 'vscode';

// To be stubbed
import * as processWatcher from '../../../src/services/processWatcher';
import * as navieConfigurationService from '../../../src/services/navieConfigurationService';
import * as authentication from '../../../src/authentication';
import ExtensionSettings from '../../../src/configuration/extensionSettings';

// To be tested
import {
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';

const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

function makeWatcher(opts: Partial<ProcessWatcherOptions> = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ProcessWatcher(Sinon.stub as any, {
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
    beforeEach(() => Sinon.stub(navieConfigurationService, 'getOpenAIApiKey').resolves(undefined));
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

  describe('loadEnvironment', () => {
    describe('without OpenAI API key', () => {
      beforeEach(() =>
        Sinon.stub(navieConfigurationService, 'getOpenAIApiKey').resolves(undefined)
      );

      it('propagates the APPMAP_API_KEY', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = await processWatcher.loadEnvironment(Sinon.stub() as any);
        expect(env).to.deep.equal({
          APPMAP_API_KEY: 'the-appmap-key',
          APPMAP_API_URL: 'https://api.getappmap.com',
        });
      });
    });

    describe('with OpenAI API key', () => {
      beforeEach(() =>
        Sinon.stub(navieConfigurationService, 'getOpenAIApiKey').resolves('the-openai-key')
      );

      it('propagates the OPENAI_API_KEY', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const env = await processWatcher.loadEnvironment(Sinon.stub() as any);
        expect(env).to.deep.equal({
          APPMAP_API_KEY: 'the-appmap-key',
          APPMAP_API_URL: 'https://api.getappmap.com',
          OPENAI_API_KEY: 'the-openai-key',
        });
      });

      it('uses it as Azure OpenAI key if Azure OpenAI is configured', async () => {
        Sinon.stub(ExtensionSettings, 'appMapCommandLineEnvironment').value({
          AZURE_OPENAI_API_VERSION: '2024-02-01',
          AZURE_OPENAI_API_INSTANCE_NAME: 'appmap-openai',
          AZURE_OPENAI_API_DEPLOYMENT_NAME: 'navie-gpt-35-test',
        });
        const env = await processWatcher.loadEnvironment({} as vscode.ExtensionContext);
        expect(env).to.deep.equal({
          APPMAP_API_KEY: 'the-appmap-key',
          APPMAP_API_URL: 'https://api.getappmap.com',
          AZURE_OPENAI_API_KEY: 'the-openai-key',
          AZURE_OPENAI_API_VERSION: '2024-02-01',
          AZURE_OPENAI_API_INSTANCE_NAME: 'appmap-openai',
          AZURE_OPENAI_API_DEPLOYMENT_NAME: 'navie-gpt-35-test',
        });
      });
    });
  });
});
