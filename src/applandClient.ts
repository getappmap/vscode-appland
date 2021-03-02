import * as vscode from 'vscode';
import { constants as fsConstants, promises as fs } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import AppLandClientConfig from './applandClientConfig';
import AppMapDescriptorRemote from './appmapDescriptorRemote';
import { buildAppMap, AppMap } from '@appland/appmap';

export class Mapset {
  public id: number;
  public name?: string;
  public branch?: string;
  public commit?: string;
  public version?: string;
  public environment?: string;
  public user?: string;
  public createdAt?: Date;

  constructor(data: Record<string, unknown>) {
    this.id = data.id as number;
    this.name = data.name as string;
    this.branch = data.branch as string;
    this.commit = data.commit as string;
    this.version = data.version as string;
    this.environment = data.environment as string;
    this.user = data.user as string;
    if (data.created_at) {
      this.createdAt = new Date(data.created_at as string);
    }
  }
}

export default class AppLandClient {
  private config: AppLandClientConfig;

  constructor(config: AppLandClientConfig) {
    this.config = config;
  }

  public static async fromEnvironment(): Promise<AppLandClient> {
    const config = await AppLandClientConfig.fromEnvironment();
    return new AppLandClient(config);
  }

  public async getApplication(
    workspace: vscode.WorkspaceFolder
  ): Promise<string> {
    const appmapYml = join(workspace.uri.fsPath, 'appmap.yml');
    try {
      await fs.access(appmapYml, fsConstants.R_OK);
      const buf = await fs.readFile(appmapYml);
      const appmap = yaml.load(buf.toString());
      return appmap.name;
    } catch (e) {
      debugger;
      // TODO.
      // Recursively search for an appmap.yml instead of giving up
    }

    // Nothing was found
    return '';
  }

  public async getMapsets(applicationId: string): Promise<Mapset[]> {
    const mapsets = await this.config.makeRequest(
      '/api/mapsets',
      { app: applicationId },
      200,
      'json'
    );
    return (await mapsets.json()).map(
      (m: Record<string, unknown>) => new Mapset(m)
    );
  }

  public async getAppMaps(mapsetId: number): Promise<AppMapDescriptorRemote[]> {
    const appmaps = await this.config.makeRequest(
      '/api/scenarios',
      { mapsets: [mapsetId] },
      200,
      'json'
    );

    return (await appmaps.json()).map((d: Record<string, unknown>) => {
      const { scenario_uuid: uuid } = d;
      return new AppMapDescriptorRemote(
        this,
        uuid as string,
        d.metadata as Record<string, unknown>
      );
    });
  }

  public async getAppMapRaw(resourceUri: vscode.Uri): Promise<string> {
    const response = await this.config.makeRequest(resourceUri.path, 'string');
    return await response.text();
  }

  public async getAppMap(descriptor: AppMapDescriptorRemote): Promise<AppMap> {
    const data = await this.getAppMapRaw(descriptor.resourceUri);
    return buildAppMap(data)
      .normalize()
      .build();
  }
}
