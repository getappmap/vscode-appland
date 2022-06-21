import assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

class WorkspaceServices {
  workspaceServices: WorkspaceService<WorkspaceServiceInstance>[] = [];
  workspaceServiceInstances: Map<vscode.WorkspaceFolder, WorkspaceServiceInstance[]> = new Map();
  instanceServices: Map<
    WorkspaceServiceInstance,
    WorkspaceService<WorkspaceServiceInstance>
  > = new Map();

  constructor(public context: vscode.ExtensionContext) {
    const folderAdded = (folder: vscode.WorkspaceFolder) => {
      this.workspaceServices.map(async (service) => {
        console.log(
          `Creating workspace service ${service.constructor.name} for ${folder.uri.toString()}`
        );
        const instance = await service.create(folder);
        this.enrollServiceInstance(folder, instance, service);
      });
    };

    const folderRemoved = (folder: vscode.WorkspaceFolder) => {
      const serviceInstances = this.workspaceServiceInstances.get(folder);
      if (!serviceInstances) return;

      serviceInstances.forEach((service) => {
        console.log(
          `Removing workspace service instance ${
            service.constructor.name
          } for ${folder.uri.toString()}`
        );

        service.dispose();
      });
    };

    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      event.removed.forEach(folderRemoved);
      event.added.forEach(folderAdded);
    });

    (vscode.workspace.workspaceFolders || []).forEach(folderAdded);
  }

  async enroll(
    service: WorkspaceService<WorkspaceServiceInstance>
  ): Promise<WorkspaceServiceInstance[]> {
    this.workspaceServices.push(service);

    return Promise.all(
      (vscode.workspace.workspaceFolders || []).map(async (folder) => {
        console.log(
          `Creating workspace service ${service.constructor.name} for ${folder.uri.toString()}`
        );
        const instance = await service.create(folder);
        this.enrollServiceInstance(folder, instance, service);
        return instance;
      })
    );
  }

  /**
   * Gets the single service instance (or `undefined`) for a given folder.
   */
  getServiceInstance(
    service: WorkspaceService<WorkspaceServiceInstance>,
    folder: vscode.WorkspaceFolder
  ): WorkspaceServiceInstance | undefined {
    const serviceInstances = this.getServiceInstances(service, folder);
    return serviceInstances.length > 0 ? serviceInstances[0] : undefined;
  }

  /**
   * Gets all instances of a given service, with an optional folder name.
   */
  getServiceInstances(
    service: WorkspaceService<WorkspaceServiceInstance>,
    folder?: vscode.WorkspaceFolder
  ): WorkspaceServiceInstance[] {
    const serviceInstances = folder
      ? this.workspaceServiceInstances.get(folder) || []
      : Array(...this.workspaceServiceInstances.values()).flat();
    return serviceInstances.filter((instance) => this.instanceServices.get(instance) === service);
  }

  private enrollServiceInstance(
    folder: vscode.WorkspaceFolder,
    instance: WorkspaceServiceInstance,
    service: WorkspaceService<WorkspaceServiceInstance>
  ) {
    this.context.subscriptions.push(instance);
    let instances = this.workspaceServiceInstances.get(folder);
    if (!instances) {
      instances = [];
      this.workspaceServiceInstances.set(folder, instances);
    }
    instances.push(instance);
    this.instanceServices.set(instance, service);
  }
}

let WORKSPACE_SERVICES: WorkspaceServices | undefined;

export function initializeWorkspaceServices(context: vscode.ExtensionContext): WorkspaceServices {
  if (!WORKSPACE_SERVICES) {
    WORKSPACE_SERVICES = new WorkspaceServices(context);
  }
  return WORKSPACE_SERVICES;
}

export function workspaceServices(): WorkspaceServices {
  assert(WORKSPACE_SERVICES, 'WorkspaceServices is not initialized');
  return WORKSPACE_SERVICES;
}
