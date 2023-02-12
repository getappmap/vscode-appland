import './support/mockVscode';
import { ProcessWatcher } from '../../../src/services/processWatcher';
import { join } from 'path';
import { Uri } from 'vscode';
import { expect } from 'chai';
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
});

let watcher: ProcessWatcher;

beforeEach(
  () =>
    (watcher = new ProcessWatcher(() => Promise.resolve([Uri.parse('test:///appmap.yml')]), {
      id: 'test process',
      modulePath: testModule,
    }))
);
