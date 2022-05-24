import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapLoader, { AppMapDescriptor } from './appmapLoader';
import AppMapDescriptorFile from './appmapLoaderFile';
import AppMapCollection from './appmapCollection';
import AppMapLoaderFile from './appmapLoaderFile';
import ChangeEventDebouncer from './changeEventDebouncer';
import { fileExists } from '../util';
import { AppMapsService } from '../appMapsService';

export default class AppMapCollectionFile implements AppMapCollection, AppMapsService {
  private _onUpdated: vscode.EventEmitter<AppMapCollection> = new ChangeEventDebouncer<
    AppMapCollection
  >();
  public readonly onUpdated: vscode.Event<AppMapCollection> = this._onUpdated.event;

  private loaders: Map<string, AppMapLoaderFile> = new Map<string, AppMapLoaderFile>();
  private currentFilter = '';

  async onDelete(uri: vscode.Uri): Promise<void> {
    if (await fileExists(uri.fsPath)) return;

    delete this.loaders[uri.fsPath];
    this._onUpdated.fire(this);
  }

  async onChange(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.loaders[uri.fsPath] = descriptor;
    } else {
      this.onDelete(uri);
    }
    this._onUpdated.fire(this);
  }

  async onCreate(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.loaders[uri.fsPath] = descriptor;
      this._onUpdated.fire(this);
    }
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
