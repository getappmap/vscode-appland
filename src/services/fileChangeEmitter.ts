import * as vscode from 'vscode';

export interface FileChangeEvent {
  uri: vscode.Uri;
  workspaceFolder: vscode.WorkspaceFolder;
}

export interface FileInitEvent {
  initializing?: boolean;
}

export class FileChangeEmitter {
  protected _onCreate = new vscode.EventEmitter<FileChangeEvent & FileInitEvent>();
  protected _onChange = new vscode.EventEmitter<FileChangeEvent>();
  protected _onDelete = new vscode.EventEmitter<FileChangeEvent>();
  public onCreate = this._onCreate.event;
  public onChange = this._onChange.event;
  public onDelete = this._onDelete.event;

  protected pipeFrom(
    watcher: vscode.FileSystemWatcher,
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    watcher.onDidCreate((uri) => {
      this._onCreate.fire({ uri, workspaceFolder });
    });

    watcher.onDidChange((uri) => {
      this._onChange.fire({ uri, workspaceFolder });
    });

    watcher.onDidDelete((uri) => {
      this._onDelete.fire({ uri, workspaceFolder });
    });
  }

  dispose(): void {
    this._onCreate.dispose();
    this._onChange.dispose();
    this._onDelete.dispose();
  }
}
