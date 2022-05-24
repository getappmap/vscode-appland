import * as vscode from 'vscode';
import FileChangeHandler from './fileChangeHandler';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AppMapWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;

  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    const appmapPattern = new vscode.RelativePattern(this.folder, `**/*.appmap.json`);
    this.watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
    this.watcher.onDidChange(handler.onChange.bind(handler));
    this.watcher.onDidCreate(handler.onCreate.bind(handler));
    this.watcher.onDidDelete(handler.onDelete.bind(handler));
  }

  async initialize() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/*.appmap.json'),
        '**/node_modules/**'
      )
    ).map(this.handler.onCreate);
    return this;
  }

  async dispose() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/*.appmap.json'),
        '**/node_modules/**'
      )
    ).map(this.handler.onDelete);
    this.watcher.dispose();
  }
}

export class AppMapWatcher implements WorkspaceService {
  constructor(public handler: FileChangeHandler) {}

  async create(folder: vscode.WorkspaceFolder): Promise<WorkspaceServiceInstance> {
    validateConfiguration();

    const watcher = new AppMapWatcherInstance(folder, this.handler);
    return watcher.initialize();
  }
}

let configurationValidated = false;

function validateConfiguration() {
  if (configurationValidated) return;

  configurationValidated = true;
  const config = vscode.workspace.getConfiguration('files');
  const values = config.get('watcherExclude') as string[] | undefined;
  // Proxy {**/.git/objects/**: true, **/.git/subtree-cache/**: true, **/node_modules/*/**: true, **/.hg/store/**: true}
  if (values && Object.keys(values).some((path) => path.split(/[\\/]/).includes('appmap'))) {
    vscode.window
      .showErrorMessage(
        `The 'appmap' folder is excluded from the VSCode file watcher. Please update the setting 'Files: Watcher Exclude' (files.watcherExclude) and remove any paths which include 'appmap'.`,
        'Open Settings'
      )
      .then(() => {
        vscode.commands.executeCommand('workbench.action.openSettings', 'files.watcherExclude');
      });
  }
}
