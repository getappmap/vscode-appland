import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import AppMapLoader, { AppMapDescriptor } from './appmapLoader';
import AppMapDescriptorFile from './appmapLoaderFile';
import AppMapCollection from './appmapCollection';
import AppMapLoaderFile from './appmapLoaderFile';
import ChangeEventDebouncer from './changeEventDebouncer';
import { AppMapsService } from '../appMapsService';
import { basename, dirname, join } from 'path';
import { CodeObject } from '@appland/models';

export default class AppMapCollectionFile implements AppMapCollection, AppMapsService {
  private _onUpdated: vscode.EventEmitter<vscode.WorkspaceFolder | undefined> =
    new ChangeEventDebouncer<vscode.WorkspaceFolder | undefined>();
  public readonly onUpdated: vscode.Event<vscode.WorkspaceFolder | undefined> =
    this._onUpdated.event;

  private loaders: Map<string, AppMapLoaderFile> = new Map<string, AppMapLoaderFile>();
  private currentFilter = '';

  async onDelete(uri: vscode.Uri): Promise<void> {
    if (this.loaders.delete(uri.fsPath)) this.emitUpdated(uri);
  }

  async onChange(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.loaders.set(uri.fsPath, descriptor);
    } else {
      this.onDelete(uri);
    }
    this.emitUpdated(uri);
  }

  async onCreate(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.collectAppMapDescriptor(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.loaders.set(uri.fsPath, descriptor);
      this.emitUpdated(uri);
    }
  }

  private emitUpdated(uri?: vscode.Uri): void {
    const workspaceFolder = uri && vscode.workspace.getWorkspaceFolder(uri);
    this._onUpdated.fire(workspaceFolder);
  }

  static async collectAppMapDescriptor(uri: vscode.Uri): Promise<AppMapDescriptor | undefined> {
    try {
      const timestamp = (await fs.stat(uri.fsPath)).mtimeMs;
      const indexDir = join(dirname(uri.fsPath), basename(uri.fsPath, '.appmap.json'));
      const metadata = JSON.parse(await fs.readFile(join(indexDir, 'metadata.json'), 'utf-8'));
      const httpServerRequests = JSON.parse(
        await fs.readFile(join(indexDir, 'canonical.httpServerRequests.json'), 'utf-8')
      );
      const sqlQueries = JSON.parse(
        await fs.readFile(join(indexDir, 'canonical.sqlNormalized.json'), 'utf-8')
      );
      const classMap = JSON.parse(
        await fs.readFile(join(indexDir, 'classMap.json'), 'utf-8')
      ) as CodeObject[];
      let functionCount = 0;
      const visitClass = (codeObject: CodeObject) => {
        if (codeObject.type === 'function') functionCount += 1;

        (codeObject.children || []).forEach(visitClass);
      };
      classMap.forEach(visitClass);

      return {
        metadata,
        timestamp: timestamp,
        numRequests: httpServerRequests.length,
        numQueries: sqlQueries.length,
        numFunctions: functionCount,
        resourceUri: uri,
      };
    } catch (e) {
      console.error(e);
      console.trace();
    }
  }

  async initialize(): Promise<void> {
    this.setFilter('');

    vscode.commands.executeCommand('setContext', 'appmap.hasData', this.loaders.size > 0);
    vscode.commands.executeCommand('setContext', 'appmap.initialized', true);
  }

  public setFilter(filter: string): void {
    this.currentFilter = filter;
    vscode.commands.executeCommand('setContext', 'appmap.numResults', this.appMaps().length);
    this.emitUpdated(undefined);
  }

  public filterDescriptor(appmapDescriptor: AppMapDescriptor, filter: string): boolean {
    const name = appmapDescriptor.metadata?.name as string | undefined;
    if (!name) {
      return false;
    }

    return name.includes(filter);
  }

  public findByName(name: string): AppMapLoader | undefined {
    return [...this.loaders.values()].find(
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
    return [...this.loaders.values()];
  }

  public allAppMapsForWorkspaceFolder(workspaceFolder: vscode.WorkspaceFolder): AppMapLoader[] {
    return this.allAppMaps().filter((appmap) =>
      appmap.descriptor.resourceUri.fsPath.startsWith(workspaceFolder.uri.fsPath)
    );
  }

  public has(uri: vscode.Uri): boolean {
    return this.loaders.has(uri.fsPath);
  }

  // This is basically an alias for onChange.
  public remove(uri: vscode.Uri): void {
    this.onDelete(uri);
  }

  public clear(): void {
    console.debug('Clearing AppMap collection from tree', this.loaders.size);
    this.loaders.clear();
    this.emitUpdated(undefined);
  }
}
