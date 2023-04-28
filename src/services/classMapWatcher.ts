import * as vscode from 'vscode';
import FileChangeHandler from './fileChangeHandler';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import Watcher from './watcher';
import { FileChangeEmitter } from './fileChangeEmitter';

class ClassMapWatcherInstance extends Watcher implements WorkspaceServiceInstance {
  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    super('classMap.json', folder, handler);
  }
}

export class ClassMapWatcher
  extends FileChangeEmitter
  implements WorkspaceService<ClassMapWatcherInstance>
{
  async create(folder: vscode.WorkspaceFolder): Promise<ClassMapWatcherInstance> {
    const watcher = new ClassMapWatcherInstance(folder, {
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
