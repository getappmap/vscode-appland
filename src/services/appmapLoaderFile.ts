import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapLoader, { AppMapDescriptor } from './appmapLoader';
import { buildAppMap, AppMap } from '@appland/models';

export default class AppMapLoaderFile implements AppMapLoader {
  public resourceUri: vscode.Uri;
  public descriptor: AppMapDescriptor;

  constructor(resourceUri: vscode.Uri, descriptor: AppMapDescriptor) {
    this.resourceUri = resourceUri;
    this.descriptor = descriptor;
  }

  public async loadAppMap(): Promise<AppMap> {
    const buf = await fs.readFile(this.resourceUri.fsPath);
    return buildAppMap(buf.toString()).normalize().build();
  }
}
