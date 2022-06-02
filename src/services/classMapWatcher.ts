import * as vscode from 'vscode';
import { fileExists } from '../util';
import FileChangeHandler from './fileChangeHandler';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class ClassMapWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;

  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    const classMapPattern = new vscode.RelativePattern(this.folder, `**/classMap.json`);
    this.watcher = vscode.workspace.createFileSystemWatcher(classMapPattern);
    this.watcher.onDidChange((uri) => {
      handler.onChange(uri);
    });
    this.watcher.onDidCreate((uri) => {
      handler.onCreate(uri);
    });
    this.watcher.onDidDelete(async (uri) => {
      if (await fileExists(uri.fsPath)) return;

      handler.onDelete(uri);
    });
  }

  async initialize() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/classMap.json'),
        '**/node_modules/**'
      )
    ).forEach(this.handler.onCreate);
    return this;
  }

  async dispose() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/classMap.json'),
        '**/node_modules/**'
      )
    ).forEach(this.handler.onDelete);
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
