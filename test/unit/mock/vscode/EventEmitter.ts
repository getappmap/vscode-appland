import type vscode from 'vscode';

export default class EventEmitter<T> implements vscode.EventEmitter<T> {
  // Store just the listener and its thisArg context.
  // O(1) removals and safe iteration.
  private listeners = new Set<{ listener: (e: T) => unknown; thisArg?: unknown }>();

  public readonly event: vscode.Event<T> = (
    listener: (e: T) => unknown,
    thisArgs?: unknown,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable => {
    const item = { listener, thisArg: thisArgs };
    this.listeners.add(item);

    const disposable = {
      dispose: () => {
        this.listeners.delete(item);
      },
    };

    // The VS Code API specifies that if a disposables array is provided,
    // the newly created disposable should be pushed to it.
    if (disposables) {
      disposables.push(disposable);
    }

    return disposable;
  };

  fire(data: T): void {
    // Array.from prevents issues if listeners are added/removed during firing
    for (const { listener, thisArg } of Array.from(this.listeners)) {
      listener.call(thisArg, data);
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}
