import '../mock/vscode';
import { expect } from 'chai';
import assert from 'node:assert';
import { join } from 'path';
import ps from 'ps-node';
import sinon from 'sinon';
import { promisify } from 'util';
import {
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';
import * as getApiKey from '../../../src/authentication';
import Sinon from 'sinon';

const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

function makeWatcher(opts: Partial<ProcessWatcherOptions> = {}) {
  return new ProcessWatcher({
    id: 'test process' as unknown as ProcessId,
    modulePath: testModule,
    cwd: '.',
    ...opts,
  });
}

describe('ProcessWatcher', () => {
  beforeEach(() => Sinon.stub(getApiKey, 'getApiKey').resolves('test-api-key'));
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
});
