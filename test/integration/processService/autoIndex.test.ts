import * as vscode from 'vscode';
import assert from 'assert';
import extensionSettings from '../../../src/configuration/extensionSettings';
import { initializeWorkspace, waitFor, waitForExtension } from '../util';
import AppMapService from '../../../src/appMapService';

describe('AutoIndex', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('picks up a custom index command setting', async () => {
    assert.strictEqual(extensionSettings.indexCommand(), `echo 'hello world'`);

    const extension = vscode.extensions.getExtension('appland.appmap');
    assert(extension);
    const appMapService: AppMapService = extension.exports;

    await waitFor(
      `AutoIndex service should be running`,
      async () => appMapService.autoIndexService.invocations.length > 0
    );

    await waitFor(
      `AutoIndex command does not match expected configuration`,
      async () =>
        !!appMapService.autoIndexService.invocations.find(
          (invocation) => invocation.command.mainCommand === 'echo'
        )
    );
    await waitFor(
      `AutoIndex command should print 'hello world'`,
      async () =>
        !!appMapService.autoIndexService.invocations.find((invocation) =>
          invocation.messages.find((msg) => msg === `[stdout] echo 'hello world': 'hello world'\n`)
        )
    );
    await waitFor(
      `AutoIndex service should be restarted`,
      async () => appMapService.autoIndexService.invocations.length > 1
    );
  });
});
