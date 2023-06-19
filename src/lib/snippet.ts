import * as vscode from 'vscode';

import { isAbsolute } from 'path';

export const DEFAULT_SPAN = 10;

export type Snippet = {
  path: string;
  lineno?: number;
  lines: string[];
};

export default async function loadSnippet(
  folder: vscode.WorkspaceFolder,
  location: string,
  behindSpan = DEFAULT_SPAN,
  aheadSpan = DEFAULT_SPAN
): Promise<Snippet | undefined> {
  const [path, lineStr] = location.split(':');
  let lineno: number | undefined;
  if (lineStr) lineno = parseInt(lineStr, 10);

  let filePath = path;
  if (isAbsolute(filePath) && filePath.startsWith(folder.uri.fsPath))
    filePath = filePath.slice(folder.uri.fsPath.length + 1);

  if (isAbsolute(filePath) || filePath.startsWith('node_modules') || filePath.startsWith('vendor'))
    return;

  const fileUri = vscode.Uri.joinPath(folder.uri, filePath);
  let fileStat: vscode.FileStat;
  let exists = false;
  try {
    fileStat = await vscode.workspace.fs.stat(fileUri);
    exists = fileStat.type === vscode.FileType.File;
  } catch (e) {
    // File doesn't exist
  }

  if (!exists) return;

  const fileContents = await vscode.workspace.fs.readFile(fileUri);
  const lines = fileContents.toString().split('\n');
  let snippet: string[];
  if (lineno) {
    snippet = lines
      .slice(Math.max(lineno - behindSpan, 0), Math.min(lineno + aheadSpan, lines.length))
      .map((line, index) => `${index + (lineno || 0) + 1}: ${line}`);
  } else {
    snippet = lines;
  }

  return {
    path: filePath,
    lineno,
    lines: snippet,
  };
}
