import '../mock/vscode';
import Sinon from 'sinon';
import { expect } from 'chai';
import assert from 'node:assert';
import { join } from 'path';
import ps from 'ps-node';
import sinon from 'sinon';
import { promisify } from 'util';

// To be stubbed
import * as processWatcher from '../../../src/services/processWatcher';
import * as navieConfigurationService from '../../../src/services/navieConfigurationService';
import * as authentication from '../../../src/authentication';

// To be tested
import {
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';

const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

function makeWatcher(opts: Partial<ProcessWatcherOptions> = {}) {
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
        const env = await processWatcher.loadEnvironment(Sinon.stub() as any);
        expect(env).to.deep.equal({
          APPMAP_API_KEY: 'the-appmap-key',
          APPMAP_API_URL: 'https://api.getappmap.com',
          OPENAI_API_KEY: 'the-openai-key',
        });
      });
    });
  });
});
