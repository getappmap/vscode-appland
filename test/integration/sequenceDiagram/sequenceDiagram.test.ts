import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import { initializeWorkspace, waitForExtension, waitFor } from '../util';
import {
  AppMapQuickPickItem,
  EXPAND_PACKAGES_TITLE,
  PACKAGES_TITLE,
} from '../../../src/lib/sequenceDiagram';
import { join } from 'path';
import assert from 'assert';
import { fileExists } from '../../../src/util';

describe('Sequence diagram', () => {
  let sinon: SinonSandbox;

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(() => (sinon = createSandbox()));

  afterEach(() => sinon.restore());
  afterEach(initializeWorkspace);

  it('can be generated', async () => {
    assert(vscode.workspace.workspaceFolders);
    const appmapUri = vscode.Uri.file(
      join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json'
      )
    );

    sinon.stub(vscode.window, 'showQuickPick').resolves({
      resourceUri: appmapUri,
      label: 'Microposts_interface micropost interface',
    } as AppMapQuickPickItem);

    const inputBox = sinon.stub(vscode.window, 'showInputBox');

    inputBox
      .onFirstCall()
      .resolves('')
      .calledWith(sinon.match({ title: PACKAGES_TITLE }));
    inputBox
      .onSecondCall()
      .resolves('')
      .calledWith(sinon.match({ title: EXPAND_PACKAGES_TITLE }));

    await vscode.commands.executeCommand('appmap.sequenceDiagram');

    const umlFile = [appmapUri.fsPath, 'uml'].join('.');
    const svgFile = [appmapUri.fsPath, 'svg'].join('.');
    await waitFor('Sequence diagram UML does not exist', () => fileExists(umlFile));
    await waitFor('Sequence diagram UML does not exist', () => fileExists(svgFile));
  });
});
