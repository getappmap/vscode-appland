import { glob } from 'glob';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { retry } from '../util';
import { rm } from 'fs/promises';

// Deletes an AppMap file along with the contents of its index directory.
// The index directory itself will be later deleted by the IndexJanitor once the relevant FileSystemWatcher events have
// been emitted.
export default async function deleteAppMap(uri: vscode.Uri): Promise<void> {
  // Remove AppMap file, remove index directory contents, then remove index directory.
  // In this order, we expect that the file change events will be reliable.
  // Need to use native filesystem operations here here, for some reason. vscode.findAllFiles isn't returning the index
  // contents, and fs.delete doesn't remove files.
  console.debug(`Deleting AppMap ${uri.fsPath}`);

  const indexDir = uri.fsPath.substring(0, uri.fsPath.lastIndexOf('.appmap.json'));

  await retry(async () => rm(uri.fsPath, { force: true }));
  await retry(async () => {
    for (const file of await promisify(glob)(`${indexDir}/*`)) {
      await rm(file, { force: true });
    }
  });
}
