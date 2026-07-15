import * as vscode from 'vscode';
import { assert } from 'chai';
import { join } from 'path';
import * as sinon from 'sinon';
import { initializeWorkspace, ProjectA, waitForExtension } from '../util';

// The deleteAppMap and openAsJson editor context commands share a workspace and setup,
// so they run as two suites in a single Electron instance rather than two.
const appmapFilePath = join(
  ProjectA,
  'tmp/appmap/minitest',
  'Microposts_controller_can_get_microposts_as_JSON.appmap.json'
);

function openTabs(): readonly vscode.Tab[] {
  return vscode.window.tabGroups.all.map((tg) => tg.tabs).flat();
}

function tabIndexForUri(uri: vscode.Uri): number {
  return openTabs().findIndex(
    (tab) =>
      (tab.input instanceof vscode.TabInputCustom ||
        tab.input instanceof vscode.TabInputText ||
        tab.input instanceof vscode.TabInputNotebook) &&
      tab.input.uri.path === uri.path
  );
}

describe('deleteAppMap test', function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => (sandbox = sinon.createSandbox()));
  beforeEach(initializeWorkspace);
  beforeEach(async () => await waitForExtension());

  afterEach(initializeWorkspace);
  afterEach(() => sandbox.restore());

  it('deletes appmap with matching URI', async () => {
    const uri: vscode.Uri = vscode.Uri.parse(`file://${appmapFilePath}`);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');
    await vscode.commands.executeCommand('appmap.context.deleteAppMap');

    assert.isTrue(tabIndexForUri(uri) === -1);
  });

  it("doesn't delete other types of files", async () => {
    const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
    const uri: vscode.Uri = vscode.Uri.parse(`file://${appmapFilePath}`);
    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(vscode.Uri.file(uri.path));
    await vscode.commands.executeCommand('appmap.context.deleteAppMap');

    assert.equal(showErrorStub.callCount, 1);
  });
});

describe('openAsJson test', function () {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => (sandbox = sinon.createSandbox()));
  beforeEach(initializeWorkspace);
  beforeEach(async () => await waitForExtension());

  afterEach(initializeWorkspace);
  afterEach(() => sandbox.restore());

  it('opens appmap with matching URI', async () => {
    const uri: vscode.Uri = vscode.Uri.parse(`file://${appmapFilePath}`);
    await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');
    await vscode.commands.executeCommand('appmap.context.openAsJson');

    assert.isTrue(tabIndexForUri(uri) !== -1);
  });

  it("doesn't open non-AppMap files", async () => {
    const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
    const uri: vscode.Uri = vscode.Uri.parse(`file://${appmapFilePath}`);
    await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(vscode.Uri.file(uri.path));
    await vscode.commands.executeCommand('appmap.context.openAsJson');

    assert.equal(showErrorStub.callCount, 1);
  });
});
