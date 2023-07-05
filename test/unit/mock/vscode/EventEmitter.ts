import type vscode from 'vscode';

export default class EventEmitter<T> implements vscode.EventEmitter<T> {
  private listeners: [(e: T) => unknown, unknown?, vscode.Disposable[]?][] = [];

  public readonly event = (
    listener: (e: T) => unknown,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable => {
    this.listeners.push([listener, thisArgs, disposables]);
    return { dispose: this.dispose };
  };

  fire(data: T): void {
    for (const [listener, thisArg] of this.listeners) listener.call(thisArg, data);
  }

  dispose(): void {
    this.listeners = [];
  }
}
