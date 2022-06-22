import * as vscode from 'vscode';
import { FileChangeHandler, FileChangeEmitter } from './fileChangeEmitter';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class AppMapWatcherInstance implements WorkspaceServiceInstance {
  watcher: vscode.FileSystemWatcher;

  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    const appmapPattern = new vscode.RelativePattern(this.folder, `**/*.appmap.json`);
    this.watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
    this.watcher.onDidChange((uri) => {
      handler.onChange(uri, this.folder);
    });
    this.watcher.onDidCreate((uri) => {
      handler.onCreate(uri, this.folder);
    });
    this.watcher.onDidDelete((uri) => {
      handler.onDelete(uri, this.folder);
    });
  }

  async initialize() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/*.appmap.json'),
        '**/node_modules/**'
      )
    ).map((uri) => this.handler.onCreate(uri, this.folder));
    return this;
  }

  async dispose() {
    (
      await vscode.workspace.findFiles(
        new vscode.RelativePattern(this.folder, '**/*.appmap.json'),
        '**/node_modules/**'
      )
    ).map((uri) => this.handler.onDelete(uri, this.folder));
    this.watcher.dispose();
  }
}

export class AppMapWatcher extends FileChangeEmitter
  implements WorkspaceService<AppMapWatcherInstance> {
  async create(folder: vscode.WorkspaceFolder): Promise<AppMapWatcherInstance> {
    validateConfiguration();

    const watcher = new AppMapWatcherInstance(folder, {
      onChange: (uri, workspaceFolder) => {
        this._onChange.fire({ uri, workspaceFolder });
      },
      onCreate: (uri, workspaceFolder) => {
        this._onCreate.fire({ uri, workspaceFolder });
      },
      onDelete: (uri, workspaceFolder) => {
        this._onDelete.fire({ uri, workspaceFolder });
      },
    });
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
