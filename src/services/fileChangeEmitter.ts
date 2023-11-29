import * as vscode from 'vscode';

export class FileChangeEmitter implements vscode.Disposable {
  protected _onCreate = new vscode.EventEmitter<vscode.Uri>();
  protected _onChange = new vscode.EventEmitter<vscode.Uri>();
  protected _onDelete = new vscode.EventEmitter<vscode.Uri>();
  public onCreate = this._onCreate.event;
  public onChange = this._onChange.event;
  public onDelete = this._onDelete.event;

  protected disposables = [this._onChange, this._onCreate, this._onDelete];

  protected pipeFrom(watcher: vscode.FileSystemWatcher): void {
    watcher.onDidCreate(this._onCreate.fire, this._onCreate, this.disposables);
    watcher.onDidChange(this._onChange.fire, this._onChange, this.disposables);
    watcher.onDidDelete(this._onDelete.fire, this._onDelete, this.disposables);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
