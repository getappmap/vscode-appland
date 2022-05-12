import * as vscode from 'vscode';

export interface ChangeHandler<T> {
  onChange(object: T, workspaceFolder: vscode.WorkspaceFolder): void;
  onCreate(object: T, workspaceFolder: vscode.WorkspaceFolder): void;
  onDelete(object: T, workspaceFolder: vscode.WorkspaceFolder): void;
}

export interface ChangedObject<T> {
  object: T;
  workspaceFolder: vscode.WorkspaceFolder;
}

export interface ChangeEvents<T> {
  onCreate: vscode.Event<ChangedObject<T>>;
  onChange: vscode.Event<ChangedObject<T>>;
  onDelete: vscode.Event<ChangedObject<T>>;
}

export class ChangeEmitter<T> implements ChangeEvents<T> {
  protected _onCreate = new vscode.EventEmitter<ChangedObject<T>>();
  protected _onChange = new vscode.EventEmitter<ChangedObject<T>>();
  protected _onDelete = new vscode.EventEmitter<ChangedObject<T>>();
  public onCreate = this._onCreate.event;
  public onChange = this._onChange.event;
  public onDelete = this._onDelete.event;

  dispose(): void {
    this._onCreate.dispose();
    this._onChange.dispose();
    this._onDelete.dispose();
  }
}
