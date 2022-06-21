import { Disposable, WorkspaceFolder } from 'vscode';

export interface WorkspaceService<T extends WorkspaceServiceInstance> {
  create(folder: WorkspaceFolder): Promise<T> | T;
}

export interface WorkspaceServiceInstance extends Disposable {
  folder: WorkspaceFolder;
}
