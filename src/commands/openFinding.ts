import * as vscode from 'vscode';

export default function registerCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('appmap.openFinding', async (uri: vscode.Uri) => {
    vscode.commands.executeCommand('vscode.open', uri);
  });
}
