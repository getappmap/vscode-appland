import { ProgressReporter } from '../../../../src/lib/assetManager';

export type ProgressMessage = {
  name: string;
  payload: Record<string, unknown>;
};

export default class TestProgressReporter implements ProgressReporter {
  messages: ProgressMessage[] = [];

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
