import * as vscode from 'vscode';

import type { AppMap } from '@appland/models';

import type AppMapLoader from '../../src/services/appmapLoader';
import type { AppMapDescriptor } from '../../src/services/appmapLoader';

export default class MockAppMapLoader implements AppMapLoader {
  public descriptor: AppMapDescriptor;

  constructor(descriptor: Partial<AppMapDescriptor> = {}) {
    this.descriptor = {
      resourceUri: vscode.Uri.file('/mock/path/mock.appmap.json'),
      timestamp: Date.now(),
      ...descriptor,
    };
  }

  async loadAppMap(): Promise<AppMap> {
    return {} as AppMap;
  }
}
