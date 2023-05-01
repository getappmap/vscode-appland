import { rmdir } from 'fs';
import { glob } from 'glob';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { retry } from '../util';
import { rm } from 'fs/promises';

export default async function deleteAppMap(uri: vscode.Uri): Promise<void> {
  // Remove AppMap file, remove index directory contents, then remove index directory.
  // In this order, we expect that the file change events will be reliable.
  // Need to use native filesystem operations here here, for some reason. vscode.findAllFiles isn't returning the index
  // contents, and fs.delete doesn't remove files.
  const indexDir = uri.fsPath.substring(0, uri.fsPath.lastIndexOf('.appmap.json'));
  const filesToDelete = await promisify(glob)(`${indexDir}/*`);

  await retry(async () => rm(uri.fsPath, { force: true }));
  await Promise.all(
    filesToDelete.map((file) => retry(async () => await rm(file, { force: true })))
  );
  await retry(async () => await promisify(rmdir)(indexDir, { recursive: true }));
}
