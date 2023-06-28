import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';
import { getWorkspaceFolderFromPath } from '../util';

export default function registerCommand(extensionState: ExtensionState): vscode.Disposable {
  return vscode.commands.registerCommand('appmap.openFinding', async (uri: vscode.Uri) => {
    const workspaceFolder = getWorkspaceFolderFromPath(uri.fsPath);
    if (workspaceFolder) {
      extensionState.setFindingsInvestigated(workspaceFolder, true);
    }

    vscode.commands.executeCommand('vscode.open', uri);
  });
}
