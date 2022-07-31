import { unlink, rmdir } from 'fs';
import { glob } from 'glob';
import { promisify } from 'util';
import * as vscode from 'vscode';
import ClassMapIndex from '../services/classMapIndex';
import FindingsIndex from '../services/findingsIndex';
import { fileExists, retry } from '../util';

async function deleteAppMap(uri: vscode.Uri): Promise<void> {
  // Remove AppMap file, remove index directory contents, then remove index directory.
  // In this order, we expect that the file change events will be reliable.

  // Need to use native filesystem operations here here, for some reason. vscode.findAllFiles isn't returning the index
  // contents, and fs.delete doesn't remove files.
  await retry(async () => promisify(unlink)(uri.fsPath));

  const indexDir = uri.fsPath.substring(0, uri.fsPath.lastIndexOf('.appmap.json'));
  const filesToDelete = await promisify(glob)(`${indexDir}/*`);
  await Promise.all(
    filesToDelete.map((file) =>
      retry(async () => {
        if (!(await fileExists(file))) return;

        await promisify(unlink)(file);
      })
    )
  );

  await retry(async () => {
    if (!(await fileExists(indexDir))) return;

    await promisify(rmdir)(indexDir, { recursive: true });
  });
}

async function deleteAppMaps(folder: vscode.WorkspaceFolder) {
  return (
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
