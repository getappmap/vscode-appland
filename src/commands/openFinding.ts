import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { getWorkspaceFolderFromPath } from '../util';

export default function registerCommand(
  context: vscode.ExtensionContext,
  projectStates: ProjectStateServiceInstance[],
  extensionState: ExtensionState
): void {
  const command = vscode.commands.registerCommand('appmap.openFinding', async (uri: vscode.Uri) => {
    const workspaceFolder = await getWorkspaceFolderFromPath(projectStates, String(uri));

    if (workspaceFolder) {
      extensionState.setFindingsInvestigated(workspaceFolder, true);
    }

    vscode.commands.executeCommand('vscode.open', uri);
  });

  context.subscriptions.push(command);
}
