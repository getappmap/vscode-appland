import * as vscode from 'vscode';
import AppMapDescriptor from './appmapDescriptor';
import { AppMap } from '@appland/appmap';
import AppLandClient from './applandClient';

export default class AppMapDescriptorRemote implements AppMapDescriptor {
  public resourceUri: vscode.Uri;
  public metadata?: Record<string, unknown>;
  private api: AppLandClient;

  constructor(api: AppLandClient, uuid: string, metadata?: Record<string, unknown>) {
    this.api = api;
    this.resourceUri = vscode.Uri.parse(`appmap:${uuid}.appmap.json`);
    this.metadata = metadata;
  }

  public async loadAppMap(): Promise<AppMap> {
    return this.api.getAppMap(this);
  }
}
