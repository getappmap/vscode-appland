import * as vscode from 'vscode';
import { assert } from 'chai';
import { join } from 'path';
import * as sinon from 'sinon';
import { initializeWorkspace, ProjectA, waitForExtension } from '../util';

describe('deleteAppMap test', function () {
  let sandbox: sinon.SinonSandbox;

  const appmapFilePath = join(
    ProjectA,
    'tmp/appmap/minitest',
    'Microposts_controller_can_get_microposts_as_JSON.appmap.json'
  );

  beforeEach(() => (sandbox = sinon.createSandbox()));
  beforeEach(initializeWorkspace);
  beforeEach(async () => await waitForExtension());

  afterEach(initializeWorkspace);
  afterEach(() => sandbox.restore());

  it('deletes appmap with matching URI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUri: vscode.Uri = { path: appmapFilePath } as any;
    await vscode.workspace.openTextDocument(mockUri);
    await vscode.window.showTextDocument(vscode.Uri.file(mockUri.path));
    await vscode.commands.executeCommand('appmap.context.deleteAppMap');

    const tabs = vscode.window.tabGroups.all.map((tg) => tg.tabs).flat();
    const index = tabs.findIndex(
      (tab) =>
        (tab.input instanceof vscode.TabInputCustom ||
          tab.input instanceof vscode.TabInputText ||
          tab.input instanceof vscode.TabInputNotebook) &&
        tab.input.uri.path === mockUri.path
    );
    assert.isTrue(index === -1);
  });
});
