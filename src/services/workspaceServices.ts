import * as vscode from 'vscode';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

export default class WorkspaceServices {
  workspaceServices: WorkspaceService[] = [];
  workspaceServiceInstances: Record<string, WorkspaceServiceInstance[]> = {};

  constructor(public context: vscode.ExtensionContext) {
    const folderAdded = (folder: vscode.WorkspaceFolder) => {
      this.workspaceServices.map(async (service) => {
        const instance = await service.create(folder);
        this.enrollServiceInstance(folder, instance);
      });
    };

    const folderRemoved = (folder: vscode.WorkspaceFolder) => {
      const serviceInstances = this.workspaceServiceInstances[folder.uri.toString()];
      if (!serviceInstances) return;

      serviceInstances.forEach((service) => service.dispose());
    };

    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      event.removed.forEach(folderRemoved);
      event.added.forEach(folderAdded);
    });

    (vscode.workspace.workspaceFolders || []).forEach(folderAdded);
  }

  async enroll(service: WorkspaceService): Promise<WorkspaceServiceInstance[]> {
    this.workspaceServices.push(service);

    return Promise.all(
      (vscode.workspace.workspaceFolders || []).map(async (folder) => {
        const instance = await service.create(folder);
        this.enrollServiceInstance(folder, instance);
        return instance;
      })
    );
  }

  private enrollServiceInstance(
    folder: vscode.WorkspaceFolder,
    instance: WorkspaceServiceInstance
  ) {
    this.context.subscriptions.push(instance);
    if (!this.workspaceServiceInstances[folder.uri.toString()])
      this.workspaceServiceInstances[folder.uri.toString()] = [];
    this.workspaceServiceInstances[folder.uri.toString()].push(instance);
  }
}
