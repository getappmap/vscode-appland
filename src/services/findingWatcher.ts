import * as vscode from 'vscode';
import { fileExists } from '../util';
import FileChangeHandler from './fileChangeHandler';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class FindingWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;

  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    const appmapPattern = new vscode.RelativePattern(this.folder, `**/appmap-findings.json`);
    this.watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
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
        new vscode.RelativePattern(this.folder, '**/appmap-findings.json'),
        '**/node_modules/**'
      )
    ).map(this.handler.onCreate);
    return this;
  }

  async dispose() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/appmap-findings.json'),
        '**/node_modules/**'
      )
    ).map(this.handler.onDelete);
    this.watcher.dispose();
  }
}

export class FindingWatcher implements WorkspaceService {
  constructor(public handler: FileChangeHandler) {}

  async create(folder: vscode.WorkspaceFolder): Promise<WorkspaceServiceInstance> {
    const watcher = new FindingWatcherInstance(folder, this.handler);
    await watcher.initialize();
    return watcher;
  }
}
