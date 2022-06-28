import * as vscode from 'vscode';
import ClassMapIndex from './classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';
import { FileChangeEvent } from './fileChangeEmitter';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class SourceFileWatcherInstance implements WorkspaceServiceInstance {
  protected watcher?: vscode.FileSystemWatcher;

  constructor(
    public folder: vscode.WorkspaceFolder,
    public classMapIndex: ClassMapIndex,
    public onChange: vscode.EventEmitter<FileChangeEvent>
  ) {
    classMapIndex.onChanged(this.initialize.bind(this));
  }

  async initialize() {
    const watcher = this.watcher;

    const fileExtensions = new Set<string>();
    const collectExtensions = (coe: CodeObjectEntry): void => {
      if (coe.path && coe.path.includes('.')) {
        const extension = coe.path.split('.').pop();
        if (extension) fileExtensions.add(extension);
      }
      coe.children.forEach(collectExtensions);
    };
    (await this.classMapIndex.classMap()).map(collectExtensions);

    const findingsPattern = `**/*.{${[...fileExtensions].sort().join(',')}}`;

    console.log(`[source-file-watcher] Watching ${findingsPattern} in ${this.folder.name}`);

    this.watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.folder, findingsPattern)
    );
    this.watcher.onDidChange((uri) => this.onChange.fire({ uri, workspaceFolder: this.folder }));
    this.watcher.onDidCreate((uri) => this.onChange.fire({ uri, workspaceFolder: this.folder }));
    this.watcher.onDidDelete((uri) => this.onChange.fire({ uri, workspaceFolder: this.folder }));

    if (watcher) watcher.dispose();
  }

  async dispose() {
    if (this.watcher) this.watcher.dispose();
    this.watcher = undefined;
  }
}

export class SourceFileWatcher implements WorkspaceService<SourceFileWatcherInstance> {
  protected _onChange = new vscode.EventEmitter<FileChangeEvent>();
  public onChange = this._onChange.event;

  constructor(public classMapIndex: ClassMapIndex) {}

  async create(folder: vscode.WorkspaceFolder): Promise<SourceFileWatcherInstance> {
    const watcher = new SourceFileWatcherInstance(folder, this.classMapIndex, this._onChange);
    await watcher.initialize();
    return watcher;
  }
}
