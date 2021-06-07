import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapDescriptor from './appmapDescriptor';
import { buildAppMap, AppMap } from '@appland/models';

export default class AppMapDescriptorFile implements AppMapDescriptor {
  public resourceUri: vscode.Uri;
  public metadata?: Record<string, unknown>;

  constructor(resourceUri: vscode.Uri, metadata: Record<string, unknown>) {
    this.resourceUri = resourceUri;
    this.metadata = metadata;
  }

  public async loadAppMap(): Promise<AppMap> {
    const buf = await fs.readFile(this.resourceUri.fsPath);
    return buildAppMap(buf.toString())
      .normalize()
      .build();
  }
}
