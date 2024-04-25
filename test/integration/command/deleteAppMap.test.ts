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
    const uri: vscode.Uri = vscode.Uri.parse(`file://${appmapFilePath}`);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');
    await vscode.commands.executeCommand('appmap.context.deleteAppMap');

    const tabs = vscode.window.tabGroups.all.map((tg) => tg.tabs).flat();
    const index = tabs.findIndex(
      (tab) =>
        (tab.input instanceof vscode.TabInputCustom ||
          tab.input instanceof vscode.TabInputText ||
          tab.input instanceof vscode.TabInputNotebook) &&
        tab.input.uri.path === uri.path
    );
    assert.isTrue(index === -1);
  });

  it("doesn't delete other types of files", async () => {
    const showErrorStub = sinon.stub(vscode.window, 'showErrorMessage');
    const uri: vscode.Uri = vscode.Uri.parse(`file://${appmapFilePath}`);
    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(vscode.Uri.file(uri.path));
    await vscode.commands.executeCommand('appmap.context.deleteAppMap');

    assert.equal(showErrorStub.callCount, 1);
  });
});
