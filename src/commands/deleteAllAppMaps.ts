import { rmdir } from 'fs';
import { glob } from 'glob';
import { promisify } from 'util';
import * as vscode from 'vscode';
import ClassMapIndex from '../services/classMapIndex';
import FindingsIndex from '../services/findingsIndex';
import { fileExists, retry } from '../util';

async function deleteAppMap(uri: vscode.Uri): Promise<void> {
  await retry(async () => vscode.workspace.fs.delete(uri));

  // Remove AppMap file, remove index directory contents, then remove index directory.
  // In this order, we expect that the file change events will be reliable.
  const indexDir = uri.fsPath.substring(0, uri.fsPath.lastIndexOf('.appmap.json'));
  // Need to use native glob here for some reason; vscode.findAllFiles isn't returning the index contents.
  const filesToDelete = await promisify(glob)(`${indexDir}/*`);
  await Promise.all(
    filesToDelete.map((file) =>
      retry(async () => {
        if (!(await fileExists(file))) return;

        await vscode.workspace.fs.delete(vscode.Uri.file(file));
      })
    )
  );

  await retry(async () => {
    if (!(await fileExists(indexDir))) return;

    await promisify(rmdir)(indexDir, { recursive: true });
  });
}

async function deleteAppMaps(folder: vscode.WorkspaceFolder): Promise<void> {
  (
    await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, '**/*.appmap.json'),
      `**/node_modules/**`
    )
  ).map(deleteAppMap.bind(null));
}

export default async function deleteAllAppMaps(
  context: vscode.ExtensionContext,
  classMapIndex?: ClassMapIndex,
  findingsIndex?: FindingsIndex
): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.deleteAllAppMaps', async () => {
    await Promise.all((vscode.workspace.workspaceFolders || []).map(deleteAppMaps));
    if (classMapIndex) classMapIndex.clear();
    if (findingsIndex) findingsIndex.clear();
  });
  context.subscriptions.push(command);
}
