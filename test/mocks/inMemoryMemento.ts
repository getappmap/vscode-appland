import { Memento } from 'vscode';

export default class InMemoryMemento implements Memento {
  private storage: { [keyName: string]: unknown } = {};

  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  get(key: string, defaultValue?: unknown): unknown {
    return this.storage[key] || defaultValue;
  }

  update(key: string, value: unknown): Thenable<void> {
    this.storage[key] = value;
    return Promise.resolve();
  }

  keys(): readonly string[] {
    return Object.keys(this.storage);
  }

  setKeysForSync(): void {
    throw new Error('Not implemented.');
  }
}
