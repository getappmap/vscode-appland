import * as vscode from 'vscode';
import { retry } from '../util';
import { rm } from 'fs/promises';
import AppMapCollection from '../services/appmapCollection';

// Deletes an AppMap file along with the contents of its index directory.
// The index directory itself will be later deleted by the IndexJanitor once the relevant FileSystemWatcher events have
// been emitted.
export default async function deleteAppMap(
  uri: vscode.Uri,
  appMapCollection: AppMapCollection
): Promise<void> {
  // Remove AppMap metadata file in the index folder, remove AppMap file, then remove index directory (recursively).
  // In this order, we expect that the file change events will be reliable.
  // Need to use native filesystem operations here here, for some reason. vscode.findAllFiles isn't returning the index
  // contents, and fs.delete doesn't remove files.
  console.debug(`Deleting AppMap ${uri.fsPath}`);

  appMapCollection.remove(uri);

  const indexDir = uri.fsPath.substring(0, uri.fsPath.lastIndexOf('.appmap.json'));

  await retry(async () => await rm(`${indexDir}/metadata.json`, { force: true }));
  await retry(async () => await rm(uri.fsPath, { force: true }));

  if (!appMapCollection.has(uri)) {
    // The collection doesn't yet know about this AppMap, so it's safe to delete the index directory without
    // worry of missing events.
    await retry(async () => await rm(indexDir, { recursive: true, force: true }));
  }
}
