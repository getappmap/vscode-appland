import * as vscode from 'vscode';
import { Dirent, promises as fs } from 'fs';
import { join } from 'path';
import AppMapDescriptor from './appmapDescriptor';
// @ts-ignore
import { buildAppMap, AppMap } from '@appland/appmap';

export default class AppMapDescriptorFile implements AppMapDescriptor {
  public resourceUri: vscode.Uri;
  public metadata?: Record<string, unknown>;

  constructor(resourceUri: vscode.Uri, metadata?: Record<string, unknown>) {
    this.resourceUri = resourceUri;
    this.metadata = metadata;
  }

  public static async fromResource(
    resourceUri: vscode.Uri
  ): Promise<AppMapDescriptorFile> {
    const buf = await fs.readFile(resourceUri.fsPath);
    const appmapJson = JSON.parse(buf.toString());
    return new AppMapDescriptorFile(resourceUri, appmapJson.metadata);
  }

  public static async findInDirectory(
    dir: string,
    recursive = true
  ): Promise<AppMapDescriptorFile[]> {
    const result: AppMapDescriptorFile[] = [];
    const files: Dirent[] = await fs.readdir(dir, { withFileTypes: true });

    await Promise.all(
      files.map(async (file) => {
        if (file.isDirectory() && recursive) {
          const descriptors = await this.findInDirectory(file.toString());
          descriptors.forEach((d) => result.push(d));
        } else if (file.name.match(/\.appmap\.json$/)) {
          try {
            const uri = vscode.Uri.file(join(dir, file.name));
            result.push(await this.fromResource(uri));
          } catch (e) {
            console.error(e);
          }
        }
      })
    );

    return result;
  }

  public static async allInWorkspace(): Promise<AppMapDescriptorFile[]> {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return Promise.resolve([]);
    }

    const listItemPromises = workspaceFolders.flatMap(async (dir) => {
      return await this.findInDirectory(dir.uri.fsPath);
    });

    return Promise.all(listItemPromises).then((listItems) =>
      Promise.resolve(listItems.flat())
    );
  }

  public async loadAppMap(): Promise<AppMap> {
    const buf = await fs.readFile(this.resourceUri.fsPath);
    return buildAppMap(buf.toString())
      .normalize()
      .build();
  }
}
