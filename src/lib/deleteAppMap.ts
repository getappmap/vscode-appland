import { rmdir, unlink } from 'fs';
import { glob } from 'glob';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { fileExists, retry } from '../util';

export default async function deleteAppMap(uri: vscode.Uri): Promise<void> {
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