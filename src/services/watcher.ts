import * as vscode from 'vscode';
import FileChangeHandler from './fileChangeHandler';
import { debuglog } from 'node:util';

const debug = debuglog('appmap-vscode:Watcher');

export default class Watcher {
  disposables: vscode.Disposable[] = [];

  constructor(
    public filePattern: string,
    public folder: vscode.WorkspaceFolder,
    public handler: FileChangeHandler
  ) {}

  async initialize() {
    for (const pattern of this.watchPatterns) {
      const description = [pattern.base, pattern.pattern].join('/');

      let watcher: vscode.FileSystemWatcher;
      this.disposables.push(
        (watcher = vscode.workspace.createFileSystemWatcher(pattern)),
        watcher.onDidChange((uri) => {
          debug('%s: onChange(%s)', description, uri);
          this.handler.onChange(uri, this.folder);
        }),
        watcher.onDidCreate((uri) => {
          debug('%s: onCreate(%s)', description, uri);
          this.handler.onCreate(uri, this.folder);
        }),
        watcher.onDidDelete((uri) => {
          debug('%s: onDelete(%s)', description, uri);
          this.handler.onDelete(uri, this.folder);
        })
      );

      debug('%s: starting initital scan', description);
      (await vscode.workspace.findFiles(pattern)).map((uri) => {
        debug('%s: onCreate(%s)', description, uri);
        this.handler.onCreate(uri, this.folder);
      });
      debug('%s: finished initital scan', description);
    }
  }

  async dispose() {
    for (const pattern of this.watchPatterns) {
      (await vscode.workspace.findFiles(pattern)).map((uri) =>
        this.handler.onDelete(uri, this.folder)
      );
    }

    this.disposables.forEach((disposable) => disposable.dispose());
  }

  get watchPatterns(): vscode.RelativePattern[] {
    return ['tmp/appmap', 'build/appmap', 'target/appmap'].map((dir) => {
      return new vscode.RelativePattern(this.folder, `**/${dir}/**/${this.filePattern}`);
    });
  }
}
