import * as vscode from 'vscode';
import FileChangeHandler from './fileChangeHandler';

export default class Watcher {
  disposables: vscode.Disposable[] = [];

  constructor(
    public filePattern: string,
    public folder: vscode.WorkspaceFolder,
    public handler: FileChangeHandler
  ) {}

  async initialize() {
    for (const pattern of this.watchPatterns) {
      let watcher: vscode.FileSystemWatcher;
      this.disposables.push(
        (watcher = vscode.workspace.createFileSystemWatcher(pattern)),
        watcher.onDidChange((uri) => {
          this.handler.onChange(uri, this.folder);
        }),
        watcher.onDidCreate((uri) => {
          this.handler.onCreate(uri, this.folder);
        }),
        watcher.onDidDelete((uri) => {
          this.handler.onDelete(uri, this.folder);
        })
      );

      (await vscode.workspace.findFiles(pattern)).map((uri) =>
        this.handler.onCreate(uri, this.folder)
      );
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
    return ['tmp/appmap', 'build', 'target'].map((dir) => {
      return new vscode.RelativePattern(this.folder, `${dir}/**/${this.filePattern}`);
    });
  }
}
