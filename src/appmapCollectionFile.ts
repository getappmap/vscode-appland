import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { basename } from 'path';
import AppMapLoader, { AppMapDescriptor } from './appmapLoader';
import AppMapDescriptorFile from './appmapLoaderFile';
import AppMapCollection from './appmapCollection';
import AppMapLoaderFile from './appmapLoaderFile';

export default class AppMapCollectionFile implements AppMapCollection {
  private static readonly GLOB_PATTERN = '**/*.appmap.json';
  private _onUpdated: vscode.EventEmitter<AppMapCollection> = new vscode.EventEmitter<
    AppMapCollection
  >();
  public readonly onUpdated: vscode.Event<AppMapCollection> = this._onUpdated.event;
  private _onContentChanged: vscode.EventEmitter<AppMapDescriptorFile> = new vscode.EventEmitter<
    AppMapDescriptorFile
  >();
  public readonly onContentChanged: vscode.Event<AppMapDescriptorFile> = this._onContentChanged
    .event;

  private loaders: Map<string, AppMapLoaderFile> = new Map<string, AppMapLoaderFile>();
  private currentFilter = '';

  constructor() {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return;
    }

    workspaceFolders.forEach((dir) => {
      const appmapPattern = new vscode.RelativePattern(dir, `**/*.appmap.json`);
      const watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);

      watcher.onDidChange((uri) => AppMapCollectionFile.validate(uri, () => this.onChange(uri)));
      watcher.onDidCreate((uri) => AppMapCollectionFile.validate(uri, () => this.onCreate(uri)));
      watcher.onDidDelete((uri) => AppMapCollectionFile.validate(uri, () => this.onDelete(uri)));
    });
  }

  static async collectAppMapDescriptor(uri: vscode.Uri): Promise<AppMapDescriptor | undefined> {
    try {
      const buf = await fs.readFile(uri.fsPath);
      const appmap = JSON.parse(buf.toString());
      let numRequests = 0;
      let numQueries = 0;
      let numFunctions = 0;

      (appmap.events || []).forEach((event) => {
        if (event.http_server_request) {
          ++numRequests;
        }

        if (event.sql_query) {
          ++numQueries;
        }
      });

      const stack = appmap.classMap || [];
      while (stack.length > 0) {
        const obj = stack.pop();
        if (obj.type === 'function') {
          ++numFunctions;
        }
        (obj.children || []).forEach((child) => stack.push(child));
      }

      return { metadata: appmap.metadata, numRequests, numQueries, numFunctions, resourceUri: uri };
    } catch (e) {
      console.error(e);
      console.trace();
    }
  }

  static validate(uri: vscode.Uri, onSuccess: (uri: vscode.Uri) => void): void {
    if (AppMapCollectionFile.validateUri(uri)) {
      onSuccess(uri);
    }
  }

  static validateUri(uri: vscode.Uri): boolean {
    const fileName = basename(uri.fsPath);
    return fileName !== 'Inventory.appmap.json';
  }

  async initialize(): Promise<void> {
    const { workspaceFolders } = vscode.workspace;
    if (workspaceFolders) {
      const files = await Promise.all(
        workspaceFolders.map(async (dir) => {
          const appmapPattern = new vscode.RelativePattern(dir, '**/*.appmap.json');
          return await vscode.workspace.findFiles(
            appmapPattern,
            '**/node_modules/**/*.appmap.json'
          );
        })
      );

      await Promise.all(
        files
          .flat()
          .filter((uri) => AppMapCollectionFile.validateUri(uri))
          .map(async (uri) => {
            const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
            if (metadata) {
              this.loaders[uri.fsPath] = new AppMapDescriptorFile(uri, metadata);
            }
          })
      );
    }

    this.setFilter('');

    vscode.commands.executeCommand(
      'setContext',
      'appmap.hasData',
      Object.keys(this.loaders).length > 0
    );
    vscode.commands.executeCommand('setContext', 'appmap.initialized', true);
  }

  public setFilter(filter: string): void {
    this.currentFilter = filter;
    vscode.commands.executeCommand('setContext', 'appmap.numResults', this.appMaps().length);
    this._onUpdated.fire(this);
  }

  public filterDescriptor(appmapDescriptor: AppMapDescriptor, filter: string): boolean {
    const name = appmapDescriptor.metadata?.name as string | undefined;
    if (!name) {
      return false;
    }

    return name.includes(filter);
  }

  public findByName(name: string): AppMapLoader | undefined {
    return Object.values(this.loaders).find((d) => d.metadata?.name === name);
  }

  public appMaps(): AppMapLoader[] {
    let loaders = this.allAppMaps();

    if (this.currentFilter !== '') {
      loaders = loaders.filter((appmap) =>
        this.filterDescriptor(appmap.descriptor, this.currentFilter)
      );
    }

    return loaders;
  }

  public allAppMaps(): AppMapLoader[] {
    return Object.values(this.loaders);
  }

  public allAppMapsForWorkspaceFolder(workspaceFolder: vscode.WorkspaceFolder): AppMapLoader[] {
    return this.allAppMaps().filter((appmap) =>
      appmap.descriptor.resourceUri.fsPath.startsWith(workspaceFolder.uri.fsPath)
    );
  }

  private async onChange(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.loaders[uri.fsPath] = descriptor;
      this._onContentChanged.fire(descriptor);
    } else {
      this.onDelete(uri);
    }
    this._onUpdated.fire(this);
  }

  private async onCreate(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.loaders[uri.fsPath] = descriptor;
      this._onUpdated.fire(this);
      this._onContentChanged.fire(descriptor);
    }
  }

  private async onDelete(uri: vscode.Uri): Promise<void> {
    delete this.loaders[uri.fsPath];
    this._onUpdated.fire(this);
  }
}
