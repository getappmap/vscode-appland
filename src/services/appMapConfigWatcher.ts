import * as vscode from 'vscode';
import { fileExists } from '../util';
import { FileChangeEmitter, FileChangeEvent } from './fileChangeEmitter';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class ConfigWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;
  protected disposables: vscode.Disposable[] = [];
  protected configPattern = new vscode.RelativePattern(this.folder, `**/appmap.yml`);

  constructor(
    public folder: vscode.WorkspaceFolder,
    protected onChange: vscode.EventEmitter<FileChangeEvent>,
    protected onCreate: vscode.EventEmitter<FileChangeEvent>,
    protected onDelete: vscode.EventEmitter<FileChangeEvent>
  ) {
    this.watcher = vscode.workspace.createFileSystemWatcher(this.configPattern);
    this.disposables.push(
      this.watcher,
      this.watcher.onDidChange((uri) => this.onChange.fire({ uri, workspaceFolder: this.folder })),
      this.watcher.onDidCreate((uri) => this.onCreate.fire({ uri, workspaceFolder: this.folder })),
      this.watcher.onDidDelete(async (uri) => {
        if (await fileExists(uri.fsPath)) return;
        this.onDelete.fire({ uri, workspaceFolder: this.folder });
      })
    );
  }

  async initialize() {
    (await vscode.workspace.findFiles(this.configPattern, '**/node_modules/**')).forEach((uri) => {
      this.onCreate.fire({ uri, workspaceFolder: this.folder });
    });
    return this;
  }

  async dispose() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/*.appmap.json'),
        '**/node_modules/**'
      )
    ).forEach((uri) => {
      this.onDelete.fire({ uri, workspaceFolder: this.folder });
    });

    this.disposables.forEach((d) => d.dispose());
  }
}

export class AppMapConfigWatcher extends FileChangeEmitter
  implements WorkspaceService<ConfigWatcherInstance> {
  async create(folder: vscode.WorkspaceFolder): Promise<ConfigWatcherInstance> {
    const watcher = new ConfigWatcherInstance(
      folder,
      this._onChange,
      this._onCreate,
      this._onDelete
    );
    return watcher.initialize();
  }
}
