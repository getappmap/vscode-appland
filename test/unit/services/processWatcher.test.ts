import '../mock/vscode';
import { expect } from 'chai';
import assert from 'node:assert';
import { join } from 'path';
import ps from 'ps-node';
import sinon from 'sinon';
import { promisify } from 'util';
import { Uri } from 'vscode';
import {
  ConfigFileProvider,
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from '../../../src/services/processWatcher';
const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

describe('ProcessWatcher', () => {
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
    });

    it('kills the process forcefully if needed', async () => {
      const clock = sinon.useFakeTimers();
      const watcher = makeWatcher({ args: ['ignore'] });
      await watcher.start();
      const { process } = watcher;
      assert(process);
      expect(await promisify(ps.lookup)({ pid: process.pid })).to.not.be.empty;

      const stop = watcher.stop();
      clock.runAll();
      await stop;

      expect(await promisify(ps.lookup)({ pid: process.pid })).to.be.empty;
      clock.restore();
    });
  });
});

function makeWatcher(opts: Partial<ProcessWatcherOptions> = {}) {
  const provider: ConfigFileProvider = {
    files() {
      return Promise.resolve([Uri.parse('test:///appmap.yml')]);
    },

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    reset() {},
  };

  return new ProcessWatcher(provider, {
    id: 'test process' as any as ProcessId,
    modulePath: testModule,
    ...opts,
  });
}
