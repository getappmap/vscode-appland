import * as vscode from 'vscode';
import FileChangeHandler from './fileChangeHandler';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class ClassMapWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;

  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    const appmapPattern = new vscode.RelativePattern(this.folder, `**/classMap.json`);
    this.watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
    this.watcher.onDidChange(handler.onChange.bind(handler));
    this.watcher.onDidCreate(handler.onCreate.bind(handler));
    this.watcher.onDidDelete(handler.onDelete.bind(handler));
  }

  async initialize() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/classMap.json'),
        '**/node_modules/**'
      )
    ).map(this.handler.onCreate);
    return this;
  }

  async dispose() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/classMap.json'),
        '**/node_modules/**'
      )
    ).map(this.handler.onDelete);
    this.watcher.dispose();
  }
}

export class ClassMapWatcher implements WorkspaceService {
  constructor(public handler: FileChangeHandler) {}

  async create(folder: vscode.WorkspaceFolder): Promise<WorkspaceServiceInstance> {
    const watcher = new ClassMapWatcherInstance(folder, this.handler);
    return watcher.initialize();
  }
}
