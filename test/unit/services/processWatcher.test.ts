import './support/mockVscode';
import { ProcessWatcher, ProcessWatcherOptions } from '../../../src/services/processWatcher';
import { join } from 'path';
import { Uri } from 'vscode';
import { expect } from 'chai';
import ps from 'ps-node';
import assert from 'node:assert';
import { promisify } from 'util';
import sinon from 'sinon';
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
  return new ProcessWatcher(() => Promise.resolve([Uri.parse('test:///appmap.yml')]), {
    id: 'test process',
    modulePath: testModule,
    ...opts,
  });
}
