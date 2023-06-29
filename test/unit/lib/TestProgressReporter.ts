import { ProgressReporter } from '../../../src/lib/javaAssetDownloader';

export type ProgressMessage = {
  name: string;
  payload: Record<string, unknown>;
};

export default class TestProgressReporter implements ProgressReporter {
  messages: ProgressMessage[] = [];

  aquiredLock(): void {
    this.messages.push({
      name: 'aquiredLock',
      payload: {},
    });
  }

  waitingOnLock(): void {
    this.messages.push({
      name: 'waitingOnLock',
      payload: {},
    });
  }

  waitingSuccess(): void {
    this.messages.push({
      name: 'waitingSuccess',
      payload: {},
    });
  }

  upToDate(): void {
    this.messages.push({
      name: 'upToDate',
      payload: {},
    });
  }

  identifiedAsset(assetName: string): void {
    this.messages.push({
      name: 'identifiedAsset',
      payload: { assetName },
    });
  }

  downloadLocked(name: string): void {
    this.messages.push({
      name: 'downloadLocked',
      payload: { name },
    });
  }

  unableToSymlink(assetName: string, symlinkPath: string): void {
    this.messages.push({
      name: 'unableToSymlink',
      payload: { assetName, symlinkPath },
    });
  }

  downloading(name: string): void {
    this.messages.push({
      name: 'downloading',
      payload: { name },
    });
  }

  downloaded(assetPath: string, symlinkCreated: boolean, version: string): void {
    this.messages.push({
      name: 'downloaded',
      payload: { assetPath, symlinkCreated, version },
    });
  }

  symlinked(assetName: string, symlinkPath: string): void {
    this.messages.push({
      name: 'symlinked',
      payload: { assetName, symlinkPath },
    });
  }

  error(err: Error): void {
    this.messages.push({
      name: 'error',
      payload: { err },
    });
  }
}
