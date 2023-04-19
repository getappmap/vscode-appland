import * as vscode from 'vscode';
import { fileExists } from '../util';
import { FileChangeEmitter, FileChangeEvent } from './fileChangeEmitter';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

export class AppMapConfigWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;
  protected disposables: vscode.Disposable[] = [];
  protected configPattern = new vscode.RelativePattern(this.folder, `**/appmap.yml`);
  public onChange = this._onChange.event;
  public onCreate = this._onCreate.event;
  public onDelete = this._onDelete.event;

  constructor(
    public folder: vscode.WorkspaceFolder,
    private _onChange: vscode.EventEmitter<FileChangeEvent>,
    private _onCreate: vscode.EventEmitter<FileChangeEvent>,
    private _onDelete: vscode.EventEmitter<FileChangeEvent>
  ) {
    this.watcher = vscode.workspace.createFileSystemWatcher(this.configPattern);
    this.disposables.push(
      this.watcher,
      this.watcher.onDidChange((uri) => this._onChange.fire({ uri, workspaceFolder: this.folder })),
      this.watcher.onDidCreate((uri) => this._onCreate.fire({ uri, workspaceFolder: this.folder })),
      this.watcher.onDidDelete(async (uri) => {
        if (await fileExists(uri.fsPath)) return;
        this._onDelete.fire({ uri, workspaceFolder: this.folder });
      })
    );
  }

  async initialize(): Promise<AppMapConfigWatcherInstance> {
    (await vscode.workspace.findFiles(this.configPattern)).forEach((uri) => {
      this._onCreate.fire({ uri, workspaceFolder: this.folder });
    });
    return this;
  }

  async dispose(): Promise<void> {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/*.appmap.json'),
        '**/node_modules/**'
      )
    ).forEach((uri) => {
      this._onDelete.fire({ uri, workspaceFolder: this.folder });
    });

    this.disposables.forEach((d) => d.dispose());
  }
}

export class AppMapConfigWatcher
  extends FileChangeEmitter
  implements WorkspaceService<AppMapConfigWatcherInstance>
{
  async create(folder: vscode.WorkspaceFolder): Promise<AppMapConfigWatcherInstance> {
    const watcher = new AppMapConfigWatcherInstance(
      folder,
      this._onChange,
      this._onCreate,
      this._onDelete
    );
    return watcher.initialize();
  }
}
