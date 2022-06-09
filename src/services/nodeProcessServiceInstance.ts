import * as vscode from 'vscode';
import { ProcessWatcher } from './processWatcher';
import { WorkspaceServiceInstance } from './workspaceService';

export default class NodeProcessServiceInstance implements WorkspaceServiceInstance {
  constructor(
    public folder: vscode.WorkspaceFolder,
    protected readonly processes: Readonly<ProcessWatcher[]>
  ) {
    this.processes.forEach((p) => p.start());
  }

  dispose(): void {
    this.processes.forEach((p) => p.dispose());
  }
}
