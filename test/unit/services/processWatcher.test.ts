import './support/mockVscode';
import { ProcessWatcher } from '../../../src/services/processWatcher';
import { join } from 'path';
import { Uri } from 'vscode';
import { expect } from 'chai';
import ps from 'ps-node';
import assert from 'node:assert';
import { promisify } from 'util';
const testModule = join(__dirname, 'support', 'simpleProcess.mjs');

describe('ProcessWatcher', () => {
  describe('stop', () => {
    it('does not send error event', async () => {
      let errorReceived: undefined | Error;
      watcher.onError((error) => (errorReceived = error));

      await watcher.start();
      await watcher.stop();

      expect(errorReceived).to.be.undefined;
    });
  });

  describe('stop', () => {
    it('waits for the process to finish', async () => {
      await watcher.start();
      const { process } = watcher;

      assert(process);

      expect(await promisify(ps.lookup)({ pid: process.pid })).to.not.be.empty;

      await watcher.stop();

      expect(await promisify(ps.lookup)({ pid: process.pid })).to.be.empty;
    });
  });
});

let watcher: ProcessWatcher;

beforeEach(
  () =>
    (watcher = new ProcessWatcher(() => Promise.resolve([Uri.parse('test:///appmap.yml')]), {
      id: 'test process',
      modulePath: testModule,
    }))
);
