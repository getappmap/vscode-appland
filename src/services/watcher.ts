import * as vscode from 'vscode';
import { FileChangeEmitter } from './fileChangeEmitter';
import { debuglog } from 'node:util';
import { findFiles } from '../lib/findFiles';

const debug = debuglog('appmap-vscode:Watcher');

export default class Watcher extends FileChangeEmitter {
  protected watcher: vscode.FileSystemWatcher;

  constructor(public filePattern: string) {
    super();
    this.watcher = vscode.workspace.createFileSystemWatcher(this.filePattern);
    setImmediate(async () => {
      await this.initialize();
      this.pipeFrom(this.watcher);
    });
  }

  async initialize() {
    debug('%s: starting initital scan', this.filePattern);
    (await findFiles(this.filePattern)).map((uri) => {
      debug('%s: onCreate(%s)', this.filePattern, uri);
      this._onCreate.fire(uri);
    });
    debug('%s: finished initital scan', this.filePattern);
  }

  async dispose() {
    super.dispose();
    this.watcher.dispose();
    (await findFiles(this.filePattern)).map((uri) => this._onDelete.fire(uri));
  }
}
