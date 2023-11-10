import { rm } from 'fs/promises';
import { dirname } from 'path';

import { Disposable, Uri } from 'vscode';

import { AppMapWatcher } from '../services/appmapWatcher';
import Watcher from '../services/watcher';
import { retry } from '../util';

enum IndexFile {
  Metadata = 0,
  ClassMap,
  NumFiles,
}

// IndexJanitor is responsible for deleting index directories once all relevant files within have been deleted.
// It does so by listening to file change events from AppMapWatcher and ClassMapWatcher and only deleting the index
// directory once all of the files have been removed. This is necessary because file system watcher events will not
// be emitted if the index directory is removed before the FileSystemWatcher picks up the file change events.
//
// https://github.com/microsoft/vscode/issues/60813
export default class IndexJanitor implements Disposable {
  private readonly disposables: Disposable[];
  private readonly removedIndexFiles = Array.from(
    { length: IndexFile.NumFiles },
    () => new Set<string>()
  );

  constructor(appMapWatcher: AppMapWatcher, classMapWatcher: Watcher) {
    this.disposables = [
      // AppMapWatcher is actually watching for changes to metadata.json, despite the URI being *.appmap.json.
      appMapWatcher.onDelete((uri) => this.update(IndexFile.Metadata, uri, 'delete')),
      appMapWatcher.onCreate((uri) => this.update(IndexFile.Metadata, uri, 'create')),
      classMapWatcher.onDelete((uri) => this.update(IndexFile.ClassMap, uri, 'delete')),
      classMapWatcher.onCreate((uri) => this.update(IndexFile.ClassMap, uri, 'create')),
    ];
  }

  private static indexPath(uri: Uri): string {
    const { fsPath } = uri;
    return fsPath.endsWith('.appmap.json')
      ? fsPath.replace(/\.appmap\.json$/, '')
      : dirname(uri.fsPath);
  }

  private update(fileType: IndexFile, fileUri: Uri, action: 'create' | 'delete') {
    const indexPath = IndexJanitor.indexPath(fileUri);
    const indexFiles = this.removedIndexFiles.at(fileType);
    if (action === 'create') {
      indexFiles?.delete(indexPath);
      return;
    }

    indexFiles?.add(indexPath);

    const isEmpty = this.removedIndexFiles.every((fileTypes) => fileTypes.has(indexPath));
    if (isEmpty) {
      this.removedIndexFiles.forEach((fileTypes) => fileTypes.delete(indexPath));
      retry(() => rm(indexPath, { recursive: true })).catch(console.error);
    }
  }

  dispose() {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}
