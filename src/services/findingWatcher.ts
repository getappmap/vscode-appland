import * as vscode from 'vscode';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import Watcher from './watcher';
import FileChangeHandler from './fileChangeHandler';
import { FileChangeEmitter } from './fileChangeEmitter';

class FindingWatcherInstance extends Watcher implements WorkspaceServiceInstance {
  protected findingsPattern = new vscode.RelativePattern(this.folder, `**/appmap-findings.json`);

  constructor(public folder: vscode.WorkspaceFolder, public handler: FileChangeHandler) {
    super('appmap-findings.json', folder, handler);
  }
}

export class FindingWatcher
  extends FileChangeEmitter
  implements WorkspaceService<FindingWatcherInstance>
{
  public static readonly serviceId = 'FindingWatcher';
  async create(folder: vscode.WorkspaceFolder): Promise<FindingWatcherInstance> {
    const watcher = new FindingWatcherInstance(folder, {
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
