import * as vscode from 'vscode';
import { assert } from 'chai';
import { join } from 'path';
import * as sinon from 'sinon';
import closeEditorByUri from '../../../src/lib/closeEditorByUri';
import { initializeWorkspace, FixtureDir, waitForExtension } from '../util';

describe('closeEditorByUri Tests', function () {
  let sandbox: sinon.SinonSandbox;

  const appmapFilePath = join(
    FixtureDir,
    'classMaps',
    'ScannerJobsController_authenticated_user_admin_can_defer_a_finding.json'
  );

  beforeEach(() => (sandbox = sinon.createSandbox()));
  beforeEach(initializeWorkspace);
  beforeEach(async () => await waitForExtension());

  afterEach(initializeWorkspace);
  afterEach(() => sandbox.restore());

  it('closes tab with matching URI', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockUri: vscode.Uri = { path: appmapFilePath } as any;
    await vscode.workspace.openTextDocument(mockUri);
    await vscode.window.showTextDocument(vscode.Uri.file(mockUri.path));
    console.debug('tabs', mockUri.path);

    await closeEditorByUri(mockUri);

    const tabs = vscode.window.tabGroups.all.map((tg) => tg.tabs).flat();
    const index = tabs.findIndex(
      (tab) =>
        tab.input instanceof vscode.TabInputCustom ||
        tab.input instanceof vscode.TabInputText ||
        (tab.input instanceof vscode.TabInputNotebook && tab.input.uri.path === mockUri.path)
    );

    assert.isTrue(index === -1);
  });
});
