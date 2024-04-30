import {
  ExtensionContext,
  SecretStorage,
  Uri,
  SecretStorageChangeEvent,
  EnvironmentVariableCollection,
  EnvironmentVariableMutator,
} from 'vscode';
import * as temp from 'temp';
import * as path from 'path';
import InMemoryMemento from './inMemoryMemento';
import EventEmitter from '../unit/mock/vscode/EventEmitter';

enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}

export default class MockExtensionContext implements ExtensionContext {
  readonly subscriptions: { dispose(): unknown }[] = [];
  readonly workspaceState = new InMemoryMemento();
  readonly globalState = new InMemoryMemento();
  readonly extensionUri: Uri;
  readonly extensionPath: string;
  readonly storageUri: Uri | undefined;
  readonly storagePath: string | undefined;
  readonly globalStorageUri: Uri;
  readonly globalStoragePath: string;
  readonly logUri: Uri;
  readonly logPath: string;
  readonly extensionMode: ExtensionMode = ExtensionMode.Test;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly extension: any = {
    packageJSON: {
      version: '1.0.0-test',
    },
  };

  readonly secrets = new (class implements SecretStorage {
    private readonly secrets = new Map<string, string>();
    private readonly _onDidChange = new EventEmitter<SecretStorageChangeEvent>();
    public readonly onDidChange = this._onDidChange.event;

    get(key: string): Thenable<string | undefined> {
      return Promise.resolve(this.secrets.get(key));
    }

    store(key: string, value: string): Thenable<void> {
      this.secrets.set(key, value);
      this._onDidChange.fire({ key });
      return Promise.resolve();
    }

    delete(key: string): Thenable<void> {
      this.secrets.delete(key);
      this._onDidChange.fire({ key });
      return Promise.resolve();
    }
  })();

  readonly environmentVariableCollection = new (class implements EnvironmentVariableCollection {
    readonly persistent: boolean = false;
    readonly description = undefined;

    getScoped(): EnvironmentVariableCollection {
      throw new Error('Not implemented');
    }

    replace(): void {
      throw new Error('Not implemented');
    }

    append(): void {
      throw new Error('Not implemented');
    }

    prepend(): void {
      throw new Error('Not implemented');
    }

    get(): EnvironmentVariableMutator | undefined {
      throw new Error('Not implemented');
    }

    forEach(): void {
      throw new Error('Not implemented');
    }

    delete(): void {
      throw new Error('Not implemented');
    }

    clear(): void {
      throw new Error('Not implemented');
    }

    [Symbol.iterator](): Iterator<[variable: string, mutator: EnvironmentVariableMutator]> {
      throw new Error('Not implemented');
    }
  })();

  constructor() {
    this.extensionPath = path.resolve(__dirname, '..');
    this.extensionUri = Uri.file(this.extensionPath);
    this.storagePath = temp.mkdirSync('mockStoragePath');
    this.storageUri = Uri.file(String(this.storagePath));
    this.globalStoragePath = temp.mkdirSync('mockGlobalStoragePath');
    this.globalStorageUri = Uri.file(this.globalStoragePath);
    this.logPath = temp.mkdirSync('mockLogPath');
    this.logUri = Uri.file(this.logPath);
  }

  asAbsolutePath(relativePath: string): string {
    return path.resolve(this.extensionPath, relativePath);
  }

  dispose(): void {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  }
}
