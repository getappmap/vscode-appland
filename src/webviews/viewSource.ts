import * as vscode from 'vscode';
import { bestFilePath } from '../lib/bestFilePath';

function openFile(uri: vscode.Uri, lineNumber: number) {
  const showOptions = {
    viewColumn: vscode.ViewColumn.Beside,
    selection: new vscode.Range(
      new vscode.Position(lineNumber - 1, 0),
      new vscode.Position(lineNumber - 1, 0)
    ),
  };
  vscode.commands.executeCommand('vscode.open', uri, showOptions);
}

export default async function viewSource(
  location: string,
  workspace?: vscode.WorkspaceFolder
): Promise<void> {
  const match = location.match(/^(.*?)(?::(\d+))?$/);
  if (!match) return;
  const [, path, lineNumberStr] = match;

  let lineNumber = 1;
  if (lineNumberStr) {
    lineNumber = Number.parseInt(lineNumberStr, 10);
  }

  const fileUri = await bestFilePath(path, workspace);
  if (fileUri) openFile(fileUri, lineNumber);
}
