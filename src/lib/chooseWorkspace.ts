import * as vscode from 'vscode';

export default async function chooseWorkspace(): Promise<vscode.WorkspaceFolder | undefined> {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    return;
  }
  let workspace: vscode.WorkspaceFolder | undefined;
  if (vscode.workspace.workspaceFolders.length === 1) {
    workspace = vscode.workspace.workspaceFolders[0];
  } else {
    workspace = await vscode.window.showWorkspaceFolderPick();
  }
  return workspace;
}
