import * as vscode from 'vscode';
import { packageManagerCommand } from '../configuration/packageManager';
import chooseWorkspace from '../lib/chooseWorkspace';
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
    const workspace = await chooseWorkspace();
    if (!workspace) return;

    const searchArg = fqid;
    const chdir = ['chdir', shellescape(workspace.uri.fsPath)];
    const [commandArgs, _] = await packageManagerCommand(workspace.uri);
    const command = [...commandArgs, shellescape('appmap', 'inspect', '-i', searchArg)].join(' ');
    appMapTerminal().show();
    appMapTerminal().sendText(chdir.join(' '));
    appMapTerminal().sendText(command);
  });
  context.subscriptions.push(command);
}
