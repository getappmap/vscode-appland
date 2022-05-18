import * as vscode from 'vscode';
import { packageManagerCommand } from '../configuration/packageManager';
import { shellescape } from '../util';

// eslint-disable-next-line @typescript-eslint/naming-convention
let _appMapTerminal: vscode.Terminal | undefined;

function appMapTerminal(): vscode.Terminal {
  if (!_appMapTerminal || _appMapTerminal.exitStatus !== undefined) {
    _appMapTerminal = vscode.window.createTerminal('AppMap');
  }
  return _appMapTerminal;
}

export default async function inspectCodeObject(context: vscode.ExtensionContext): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.inspectCodeObject', async (fqid) => {
    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return;
    }
    let workspace: vscode.WorkspaceFolder | undefined;
    if (vscode.workspace.workspaceFolders.length === 1) {
      workspace = vscode.workspace.workspaceFolders[0];
    } else {
      workspace = await vscode.window.showWorkspaceFolderPick();
    }
    if (!workspace) return;

    const searchArg = fqid;
    const command = [
      ...(await packageManagerCommand(workspace.uri)),
      shellescape('appmap', 'inspect', '-i', searchArg),
    ].join(' ');
    appMapTerminal().show();
    appMapTerminal().sendText(command);
  });
  context.subscriptions.push(command);
}
