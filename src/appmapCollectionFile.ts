import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { basename } from 'path';
import AppMapDescriptor from './appmapDescriptor';
import AppMapDescriptorFile from './appmapDescriptorFile';
import AppMapCollection from './appmapCollection';

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

  private descriptors: Map<string, AppMapDescriptorFile> = new Map<string, AppMapDescriptorFile>();
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

  static async getMetadata(uri: vscode.Uri): Promise<Record<string, unknown> | null> {
    try {
      const buf = await fs.readFile(uri.fsPath);
      const appmapJson = JSON.parse(buf.toString());
      return appmapJson.metadata;
    } catch (e) {
      console.error(e);
      console.trace();
    }

    return null;
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
    if (!workspaceFolders) {
      return;
    }

    const files = await Promise.all(
      workspaceFolders.map(async (dir) => {
        const appmapPattern = new vscode.RelativePattern(dir, '**/*.appmap.json');
        return await vscode.workspace.findFiles(appmapPattern);
      })
    );

    await Promise.all(
      files
        .flat()
        .filter((uri) => AppMapCollectionFile.validateUri(uri))
        .map(async (uri) => {
          const metadata = await AppMapCollectionFile.getMetadata(uri);
          if (metadata) {
            this.descriptors[uri.fsPath] = new AppMapDescriptorFile(uri, metadata);
          }
        })
    );

    this.setFilter('');

    vscode.commands.executeCommand(
      'setContext',
      'appmap.hasData',
      Object.keys(this.descriptors).length > 0
    );
    vscode.commands.executeCommand('setContext', 'appmap.initialized', true);
  }

  public setFilter(filter: string): void {
    this.currentFilter = filter;
    vscode.commands.executeCommand(
      'setContext',
      'appmap.numResults',
      this.appmapDescriptors().length
    );
    this._onUpdated.fire(this);
  }

  public filterDescriptor(appmapDescriptor: AppMapDescriptor, filter: string): boolean {
    const name = appmapDescriptor.metadata?.name as string;
    return name.includes(filter);
  }

  public findByName(name: String): AppMapDescriptor | undefined {
    return Object.values(this.descriptors).find((d) => d.metadata?.name === name);
  }

  public appmapDescriptors(): AppMapDescriptor[] {
    let descriptors = this.allDescriptors();

    if (this.currentFilter !== '') {
      descriptors = descriptors.filter((d) => this.filterDescriptor(d, this.currentFilter));
    }

    return descriptors;
  }

  public allDescriptors(): AppMapDescriptor[] {
    return Object.values(this.descriptors);
  }

  private async onChange(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.getMetadata(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.descriptors[uri.fsPath] = descriptor;
      this._onContentChanged.fire(descriptor);
    } else {
      this.onDelete(uri);
    }
    this._onUpdated.fire(this);
  }

  private async onCreate(uri: vscode.Uri): Promise<void> {
    const metadata = await AppMapCollectionFile.getMetadata(uri);
    if (metadata) {
      const descriptor = new AppMapDescriptorFile(uri, metadata);
      this.descriptors[uri.fsPath] = descriptor;
      this._onUpdated.fire(this);
      this._onContentChanged.fire(descriptor);
    }
  }

  private async onDelete(uri: vscode.Uri): Promise<void> {
    delete this.descriptors[uri.fsPath];
    this._onUpdated.fire(this);
  }
}
