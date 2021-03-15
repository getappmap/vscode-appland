import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapDescriptor from './appmapDescriptor';
import AppMapDescriptorRemote from './AppMapDescriptorRemote';
import AppMapCollection from './appmapCollection';
import { Mapset, default as AppLandClient } from './applandClient';

export default class AppMapCollectionRemote implements AppMapCollection {
  private _onUpdated: vscode.EventEmitter<AppMapCollection> = new vscode.EventEmitter<AppMapCollection>();
  public readonly onUpdated: vscode.Event<AppMapCollection> = this._onUpdated.event;

  private descriptors: AppMapDescriptorRemote[] = [];
  private api: AppLandClient;

  constructor(api: AppLandClient) {
    this.api = api;
  }

  static async getMetadata(uri: vscode.Uri): Promise<Record<string, unknown> | null> {
    try {
      const buf = await fs.readFile(uri.fsPath);
      const appmapJson = JSON.parse(buf.toString());
      return appmapJson.metadata;
    } catch (e) {
      console.error(e);
      console.trace();
    }

    return null;
  }

  private setDescriptors(descriptors: AppMapDescriptorRemote[]): void {
    this.descriptors = descriptors;
    this._onUpdated.fire(this);
  }

  private async fetch(): Promise<void> {
    let applicationId = '';
    const { workspaceFolders } = vscode.workspace;
    if (workspaceFolders) {
      for (let i = 0; i < workspaceFolders.length; ++i) {
        const workspace = workspaceFolders[i];
        applicationId = await this.api.getApplication(workspace);
        if (applicationId) {
          break;
        }
      }
    }

    const mapsets = await this.api.getMapsets(applicationId);
    const mainBranch = mapsets
      .sort((a: Mapset, b: Mapset) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
      .find((m: Mapset) => m.branch === 'master' || m.branch === 'main');

    if (mainBranch) {
      const descriptors = await this.api.getAppMaps(mainBranch.id);
      this.setDescriptors(descriptors);
    }
  }

  async initialize(): Promise<void> {
    await this.fetch();
  }

  public appmapDescriptors(): AppMapDescriptor[] {
    return this.descriptors;
  }
}
