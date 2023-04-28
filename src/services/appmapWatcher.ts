import * as vscode from 'vscode';
import { FileChangeEmitter } from './fileChangeEmitter';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import FileChangeHandler from './fileChangeHandler';
import Watcher from './watcher';

class AppMapWatcherInstance extends Watcher implements WorkspaceServiceInstance {
  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    super('*.appmap.json', folder, handler);
  }
}

export class AppMapWatcher
  extends FileChangeEmitter
  implements WorkspaceService<AppMapWatcherInstance>
{
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
    await watcher.initialize();
    return watcher;
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
