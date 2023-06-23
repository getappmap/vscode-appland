import { Disposable, WorkspaceFolder } from 'vscode';

export interface WorkspaceService<T extends WorkspaceServiceInstance> {
  create(folder: WorkspaceFolder): Promise<T> | T;
}

export interface WorkspaceServiceConstructor<T extends WorkspaceService<WorkspaceServiceInstance>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (...args: any[]): T;
  serviceId: string;
}

export function workspaceServiceId({
  constructor,
}: WorkspaceService<WorkspaceServiceInstance>): string {
  if ('serviceId' in constructor && typeof constructor.serviceId === 'string')
    return constructor.serviceId;
  else return constructor.name;
}

export interface WorkspaceServiceInstance extends Disposable {
  folder: WorkspaceFolder;
}

export type WorkspaceServiceInstanceType<T extends WorkspaceService<WorkspaceServiceInstance>> =
  T extends WorkspaceService<infer I> ? I : never;
