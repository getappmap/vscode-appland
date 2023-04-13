import assert from 'assert';
import * as vscode from 'vscode';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

export class WorkspaceServices implements vscode.Disposable {
  workspaceServices: WorkspaceService<WorkspaceServiceInstance>[] = [];
  workspaceServiceInstances: Map<vscode.WorkspaceFolder, WorkspaceServiceInstance[]> = new Map();
  instanceServices: Map<WorkspaceServiceInstance, WorkspaceService<WorkspaceServiceInstance>> =
    new Map();

  constructor() {
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

  unenroll(service: WorkspaceService<WorkspaceServiceInstance>): void {
    const index = this.workspaceServices.findIndex((s) => service === s);
    if (index === -1) return;
    this.workspaceServices.splice(index, 1);

    const removedServiceInstances = new Set<WorkspaceServiceInstance>();

    // remove instances from instanceServices
    [...this.instanceServices.entries()].forEach(([serviceInstance, parentService]) => {
      if (parentService !== service) return;

      this.instanceServices.delete(serviceInstance);
      removedServiceInstances.add(serviceInstance);
    });

    // Remove instances from workspaceServiceInstances
    [...this.workspaceServiceInstances.entries()].forEach(([wsFolder, serviceInstances]) => {
      this.workspaceServiceInstances.set(
        wsFolder,
        serviceInstances.filter((i) => !removedServiceInstances.has(i))
      );
    });

    removedServiceInstances.forEach((s) => s.dispose());
  }

  getService<
    ServiceInstanceType extends WorkspaceServiceInstance,
    ServiceType extends WorkspaceService<ServiceInstanceType>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  >(c: { new (...args: any[]): ServiceType }): ServiceType | undefined {
    return this.workspaceServices.find((service) => service.constructor === c) as ServiceType;
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
   * Gets the single service instance (or `undefined`) from the class for a given folder.
   */
  getServiceInstanceFromClass<
    ServiceInstanceType extends WorkspaceServiceInstance,
    ServiceType extends WorkspaceService<ServiceInstanceType>
  >(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    serviceClass: { new (...args: any[]): ServiceType },
    folder: vscode.WorkspaceFolder
  ): ServiceInstanceType | undefined {
    const service = this.getService(serviceClass);
    if (!service) return;
    return this.getServiceInstance(service, folder) as ServiceInstanceType;
  }

  /**
   * Gets all instances of a given service, with an optional folder name.
   */
  getServiceInstances<ServiceInstanceType extends WorkspaceServiceInstance>(
    service: WorkspaceService<ServiceInstanceType>,
    folder?: vscode.WorkspaceFolder
  ): ServiceInstanceType[] {
    const serviceInstances = folder
      ? this.workspaceServiceInstances.get(folder) || []
      : Array(...this.workspaceServiceInstances.values()).flat();
    return serviceInstances.filter(
      (instance) => this.instanceServices.get(instance) === service
    ) as ServiceInstanceType[];
  }

  enrollServiceInstance(
    folder: vscode.WorkspaceFolder,
    instance: WorkspaceServiceInstance,
    service: WorkspaceService<WorkspaceServiceInstance>
  ) {
    let instances = this.workspaceServiceInstances.get(folder);
    if (!instances) {
      instances = [];
      this.workspaceServiceInstances.set(folder, instances);
    }
    instances.push(instance);
    this.instanceServices.set(instance, service);
  }

  unenrollServiceInstance(
    folder: vscode.WorkspaceFolder,
    instanceToRemove: WorkspaceServiceInstance
  ) {
    const instances = this.workspaceServiceInstances.get(folder);
    if (!instances) return;
    const updatedInstances = instances.filter((instance) => instance !== instanceToRemove);
    this.workspaceServiceInstances.set(folder, updatedInstances);
    this.instanceServices.delete(instanceToRemove);
  }

  dispose(): void {
    [...this.instanceServices.keys()].forEach((service) => service.dispose());
  }
}

let WORKSPACE_SERVICES: WorkspaceServices | undefined;

export function initializeWorkspaceServices(): WorkspaceServices {
  if (!WORKSPACE_SERVICES) {
    WORKSPACE_SERVICES = new WorkspaceServices();
  }
  return WORKSPACE_SERVICES;
}

export function workspaceServices(): WorkspaceServices {
  assert(WORKSPACE_SERVICES, 'WorkspaceServices is not initialized');
  return WORKSPACE_SERVICES;
}
