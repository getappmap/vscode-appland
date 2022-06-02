import { Disposable, WorkspaceFolder } from 'vscode';

export interface WorkspaceService {
  create(folder: WorkspaceFolder): Promise<WorkspaceServiceInstance> | WorkspaceServiceInstance;
}

export interface WorkspaceServiceInstance extends Disposable {
  folder: WorkspaceFolder;
}
