import type { Disposable, EventEmitter } from 'vscode';

export default class MockEventEmitter<T> implements EventEmitter<T> {
  private listeners: [(e: T) => unknown, unknown?, Disposable[]?][] = [];

  public readonly event = (
    listener: (e: T) => unknown,
    thisArgs?: unknown,
    disposables?: Disposable[]
  ): Disposable => {
    this.listeners.push([listener, thisArgs, disposables]);
    return { dispose: this.dispose };
  };

  fire(data: T): void {
    for (const [listener, thisArg] of this.listeners) listener.call(thisArg, data);
  }

  dispose(): void {
    throw new Error('Method not implemented.');
  }
}
