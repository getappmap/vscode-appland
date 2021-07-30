import {
  ExtensionContext,
  SecretStorage,
  Uri,
  Event,
  SecretStorageChangeEvent,
  EnvironmentVariableCollection,
  EnvironmentVariableMutator,
  ExtensionMode,
} from 'vscode';
import * as temp from 'temp';
import * as path from 'path';
import InMemoryMemento from './inMemoryMemento';

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
    get(): Thenable<string | undefined> {
      throw new Error('Not implemented');
    }

    store(): Thenable<void> {
      throw new Error('Not implemented');
    }

    delete(): Thenable<void> {
      throw new Error('Not implemented');
    }

    onDidChange!: Event<SecretStorageChangeEvent>;
  })();

  readonly environmentVariableCollection = new (class implements EnvironmentVariableCollection {
    readonly persistent: boolean = false;

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
