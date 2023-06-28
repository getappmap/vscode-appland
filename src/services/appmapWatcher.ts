import * as vscode from 'vscode';
import { FileChangeEmitter } from './fileChangeEmitter';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import FileChangeHandler from './fileChangeHandler';
import Watcher from './watcher';
import { dirname } from 'path';
import { WorkspaceServices } from './workspaceServices';
import { AppmapConfigManager, AppmapConfigManagerInstance } from './appmapConfigManager';

class AppMapWatcherInstance extends Watcher implements WorkspaceServiceInstance {
  constructor(
    public folder: vscode.WorkspaceFolder,
    public handler: FileChangeHandler,
    public configManagerInstance: AppmapConfigManagerInstance | undefined
  ) {
    super('metadata.json', folder, handler, configManagerInstance);
  }
}

function appmapUri(uri: vscode.Uri): vscode.Uri {
  return vscode.Uri.file([dirname(uri.fsPath), 'appmap.json'].join('.'));
}

export class AppMapWatcher
  extends FileChangeEmitter
  implements WorkspaceService<AppMapWatcherInstance>
{
  constructor(private readonly workspaceServices: WorkspaceServices) {
    super();
  }

  async create(folder: vscode.WorkspaceFolder): Promise<AppMapWatcherInstance> {
    validateConfiguration();

    // Sometimes its important to know if `onCreated` is firing due to the creation of a new
    // AppMap, or if it's just firing because the watcher is being initialized. AppMaps present
    // in the workspace when the watcher starts will all fire `onCreated` events.
    let initializing = true;

    const configManagerInstance = this.workspaceServices.getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    ) as AppmapConfigManagerInstance | undefined;

    const watcher = new AppMapWatcherInstance(
      folder,
      {
        onChange: (uri, workspaceFolder) => {
          this._onChange.fire({ uri: appmapUri(uri), workspaceFolder });
        },
        onCreate: (uri, workspaceFolder) => {
          this._onCreate.fire({ uri: appmapUri(uri), workspaceFolder, initializing });
        },
        onDelete: (uri, workspaceFolder) => {
          this._onDelete.fire({ uri: appmapUri(uri), workspaceFolder });
        },
      },
      configManagerInstance
    );

    await watcher.initialize();
    initializing = false;

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
