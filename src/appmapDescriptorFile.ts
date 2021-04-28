import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapDescriptor from './appmapDescriptor';
import { buildAppMap, AppMap } from '@appland/appmap';
import { notEmpty } from './util';

export default class AppMapDescriptorFile implements AppMapDescriptor {
  public resourceUri: vscode.Uri;
  public metadata?: Record<string, unknown>;
  private _onAppMapsUpdated: vscode.EventEmitter<AppMapDescriptorFile[]> = new vscode.EventEmitter<
    AppMapDescriptorFile[]
  >();
  public readonly onAppMapsUpdated: vscode.Event<AppMapDescriptorFile[]> = this._onAppMapsUpdated
    .event;

  constructor(resourceUri: vscode.Uri, metadata: Record<string, unknown>) {
    this.resourceUri = resourceUri;
    this.metadata = metadata;
  }

  public static async allInWorkspace(): Promise<AppMapDescriptorFile[]> {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return Promise.resolve([]);
    }

    const listItemPromises = workspaceFolders.flatMap(async (dir) => {
      const appmapPattern = new vscode.RelativePattern(dir, `**/*.appmap.json`);
      const files = await vscode.workspace.findFiles(appmapPattern);
      return (
        await Promise.all(
          files.map(async (uri) => {
            try {
              const buf = await fs.readFile(uri.fsPath);
              const appmapJson = JSON.parse(buf.toString());
              return new AppMapDescriptorFile(uri, appmapJson.metadata);
            } catch (e) {
              console.error(e);
              console.trace();
            }
          })
        )
      ).filter(notEmpty);
    });

    return Promise.all(listItemPromises).then((listItems) => Promise.resolve(listItems.flat()));
  }

  public static watchWorkspaces(): void {
    vscode.workspace.workspaceFolders?.forEach((dir) => {
      const appmapPattern = new vscode.RelativePattern(dir, `**/*.appmap.json`);
      const watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
      watcher.onDidChange((e) => {
        console.log(e);
      });
      watcher.onDidCreate((e) => {
        console.log(e);
      });
      watcher.onDidDelete((e) => {
        console.log(e);
      });
    });
  }

  public async loadAppMap(): Promise<AppMap> {
    const buf = await fs.readFile(this.resourceUri.fsPath);
    return buildAppMap(buf.toString())
      .normalize()
      .build();
  }
}
