import { dirname } from 'node:path';
import { debuglog } from 'node:util';

import * as vscode from 'vscode';

import { FileChangeEmitter } from './fileChangeEmitter';
import { findFiles } from '../lib/findFiles';

const debug = debuglog('appmap-vscode:AppMapWatcher');

const pattern = '**/metadata.json';
export class AppMapWatcher extends FileChangeEmitter {
  private watcher: vscode.FileSystemWatcher;

  constructor() {
    super();
    validateConfiguration();
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
  }

  async initialize() {
    debug('%s: starting initital scan', pattern);
    (await findFiles(pattern)).map((uri) => {
      debug('%s: onCreate(%s)', pattern, uri);
      this._onCreate.fire(appmapUri(uri));
    });
    debug('%s: finished initital scan', pattern);

    this.watcher.onDidCreate(
      (uri) => this._onCreate.fire(appmapUri(uri)),
      this._onCreate,
      this.disposables
    );
    this.watcher.onDidChange(
      (uri) => this._onChange.fire(appmapUri(uri)),
      this._onChange,
      this.disposables
    );
    this.watcher.onDidDelete(
      (uri) => this._onDelete.fire(appmapUri(uri)),
      this._onDelete,
      this.disposables
    );
  }
}

function appmapUri(uri: vscode.Uri): vscode.Uri {
  return vscode.Uri.file([dirname(uri.fsPath), 'appmap.json'].join('.'));
}

function validateConfiguration() {
  const config = vscode.workspace.getConfiguration('files');
  const values = config.get<Record<string, boolean>>('watcherExclude');
  // Proxy {**/.git/objects/**: true, **/.git/subtree-cache/**: true, **/node_modules/*/**: true, **/.hg/store/**: true}
  if (values && Object.keys(values).some((path) => path.split(/[\\/]/).includes('appmap'))) {
    vscode.window
      .showErrorMessage(
        `The 'appmap' folder is excluded from the VSCode file watcher. Please update the setting 'Files: Watcher Exclude' (files.watcherExclude) and remove any paths which include 'appmap'.`,
        'Open Settings'
      )
      .then(() => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'files.watcherExclude');
      });
  }
}
