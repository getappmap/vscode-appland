import * as vscode from 'vscode';

import type AppMapCollection from '../../src/services/appmapCollection';
import type AppMapLoader from '../../src/services/appmapLoader';

import EventEmitter from '../unit/mock/vscode/EventEmitter';

export default class MockAppMapCollection implements AppMapCollection {
  public readonly _onUpdated = new EventEmitter<vscode.WorkspaceFolder | undefined>();
  public readonly onUpdated = this._onUpdated.event;

  public allAppMaps(): AppMapLoader[] {
    return [];
  }

  public appMaps(): AppMapLoader[] {
    return [];
  }

  public allAppMapsForWorkspaceFolder(): AppMapLoader[] {
    return [];
  }

  public has(): boolean {
    return false;
  }

  public remove(): void {
    // no-op
  }

  public clear(): void {
    // no-op
  }
}
