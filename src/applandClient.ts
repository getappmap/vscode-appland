import * as vscode from 'vscode';
import { constants as fsConstants, promises as fs } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import AppLandClientConfig from './applandClientConfig';
import AppMapDescriptorRemote from './appmapDescriptorRemote';
// @ts-ignore
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
      const appmap = yaml.load(buf);
      return appmap.name;
    } catch (e) {
      // TODO.
      // Recursively search for an appmap.yml instead of giving up
    }

    // Nothing was found
    return '';
  }

  public async getMapsets(applicationId: string): Promise<Mapset[]> {
    const params = JSON.stringify({ app: applicationId });
    const mapsets = await this.config.makeRequest(
      '/api/mapsets',
      params,
      200,
      'json'
    );
    return mapsets.map((m: Record<string, unknown>) => new Mapset(m));
  }

  public async getAppMaps(mapsetId: number): Promise<AppMapDescriptorRemote[]> {
    const params = JSON.stringify({ mapsets: [mapsetId] });
    const appmaps = await this.config.makeRequest(
      '/api/scenarios',
      params,
      200,
      'json'
    );

    return appmaps.map((d: Record<string, unknown>) => {
      const { apiUrl } = this.config;
      const { scenario_uuid: uuid } = d;
      const scenarioUri = vscode.Uri.parse(`${apiUrl}/api/scenarios/${uuid}`);
      return new AppMapDescriptorRemote(
        this,
        scenarioUri,
        d.metadata as Record<string, unknown>
      );
    });
  }

  public async getAppMap(descriptor: AppMapDescriptorRemote): Promise<AppMap> {
    const appmapJson = await this.config.makeRequest(
      descriptor.resourceUri.path,
      200,
      'json'
    );

    return buildAppMap(appmapJson)
      .normalize()
      .build();
  }
}
