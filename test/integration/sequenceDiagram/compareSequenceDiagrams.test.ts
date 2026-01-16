import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import { initializeWorkspace, waitForExtension, waitFor } from '../util';
import { EXPAND_PACKAGES_TITLE, PACKAGES_TITLE } from '../../../src/lib/sequenceDiagram';
import { join } from 'path';
import assert from 'assert';
import { fileExists } from '../../../src/util';

describe('Compare sequence diagram', () => {
  let sinon: SinonSandbox;

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(() => (sinon = createSandbox()));

  afterEach(() => sinon.restore());
  afterEach(initializeWorkspace);

  it('can be generated', async () => {
    assert(vscode.workspace.workspaceFolders);
    const baseUri = vscode.Uri.file(
      join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
      )
    );
    const headUri = vscode.Uri.file(
      join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json'
      )
    );

    const quickPick = sinon.stub(vscode.window, 'showQuickPick');
    quickPick.onFirstCall().resolves({
      label: 'Microposts_controller_can_get_microposts_as_JSON',
      detail: baseUri.fsPath,
    } as vscode.QuickPickItem);

    const inputBox = sinon.stub(vscode.window, 'showInputBox');

    inputBox
      .onFirstCall()
      .resolves('')
      .calledWith(sinon.match({ title: PACKAGES_TITLE }));
    inputBox
      .onSecondCall()
      .resolves('')
      .calledWith(sinon.match({ title: EXPAND_PACKAGES_TITLE }));

    quickPick.onSecondCall().resolves({
      label: 'Microposts_interface_micropost_interface',
      detail: headUri.fsPath,
    } as vscode.QuickPickItem);

    const openExternal = sinon.stub(vscode.env, 'openExternal');

    let tempFileUri: vscode.Uri | undefined;
    openExternal.callsFake((target): Promise<boolean> => {
      tempFileUri = target;
      return Promise.resolve(true);
    });

    await vscode.commands.executeCommand('appmap.compareSequenceDiagrams');
    await waitFor(
      'UML file was not opened',
      async () => !!tempFileUri?.fsPath && (await fileExists(tempFileUri.fsPath))
    );
  });
});
