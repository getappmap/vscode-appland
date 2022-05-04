import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapLoader, { AppMapDescriptor } from './appmapLoader';
import AppMapDescriptorFile from './appmapLoaderFile';
import AppMapCollection from './appmapCollection';
import AppMapLoaderFile from './appmapLoaderFile';
import appmapWatcher from './appmapWatcher';

export default class AppMapCollectionFile implements AppMapCollection {
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

  constructor(context: vscode.ExtensionContext) {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return;
    }

    const onDelete = async (uri: vscode.Uri): Promise<void> => {
      delete this.loaders[uri.fsPath];
      this._onUpdated.fire(this);
    };

    const onChange = async (uri: vscode.Uri): Promise<void> => {
      const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
      if (metadata) {
        const descriptor = new AppMapDescriptorFile(uri, metadata);
        this.loaders[uri.fsPath] = descriptor;
        this._onContentChanged.fire(descriptor);
      } else {
        onDelete(uri);
      }
      this._onUpdated.fire(this);
    };

    const onCreate = async (uri: vscode.Uri): Promise<void> => {
      const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
      if (metadata) {
        const descriptor = new AppMapDescriptorFile(uri, metadata);
        this.loaders[uri.fsPath] = descriptor;
        this._onUpdated.fire(this);
        this._onContentChanged.fire(descriptor);
      }
    };

    appmapWatcher(context, { onCreate, onChange, onDelete });
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
        files.flat().map(async (uri) => {
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
    return Object.values(this.loaders).find(
      (d: AppMapLoaderFile) => d.descriptor.metadata?.name === name
    );
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
}
