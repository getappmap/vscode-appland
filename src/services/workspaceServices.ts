import assert from 'assert';
import * as vscode from 'vscode';
import {
  WorkspaceService,
  WorkspaceServiceConstructor,
  WorkspaceServiceInstance,
  WorkspaceServiceInstanceType,
  workspaceServiceId,
} from './workspaceService';

export class WorkspaceServices implements vscode.Disposable {
  workspaceServices: WorkspaceService<WorkspaceServiceInstance>[] = [];
  workspaceServiceInstances: Map<vscode.WorkspaceFolder, WorkspaceServiceInstance[]> = new Map();
  instanceServices: Map<WorkspaceServiceInstance, WorkspaceService<WorkspaceServiceInstance>> =
    new Map();

  constructor() {
    const folderAdded = (folder: vscode.WorkspaceFolder) => {
      this.workspaceServices.map(async (service) => {
        console.log(
          `Creating workspace service ${workspaceServiceId(service)} for ${folder.uri.toString()}`
        );
        const instance = await service.create(folder);
        this.enrollServiceInstance(folder, instance, service);
      });
    };

    const folderRemoved = (folder: vscode.WorkspaceFolder) => {
      const serviceInstances = this.workspaceServiceInstances.get(folder);
      if (!serviceInstances) return;

      serviceInstances.forEach((service) => {
        const parent = this.instanceServices.get(service);
        const name = parent ? workspaceServiceId(parent) : service.constructor.name;
        console.log(`Removing workspace service instance ${name} for ${folder.uri.toString()}`);

        service.dispose();
      });
    };

    vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
      event.removed.forEach(folderRemoved);
      event.added.forEach(folderAdded);
    });

    (vscode.workspace.workspaceFolders || []).forEach(folderAdded);
  }

  async enroll<
    T extends WorkspaceService<I>,
    I extends WorkspaceServiceInstance = WorkspaceServiceInstanceType<T>
  >(service: T): Promise<I[]> {
    this.workspaceServices.push(service);

    return Promise.all(
      (vscode.workspace.workspaceFolders || []).map(async (folder) => {
        console.log(
          `Creating workspace service ${workspaceServiceId(service)} for ${folder.uri.toString()}`
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

  getService<ServiceType extends WorkspaceService<WorkspaceServiceInstance>>(
    c: WorkspaceServiceConstructor<ServiceType>
  ): ServiceType | undefined {
    return this.workspaceServices.find(
      (service) => workspaceServiceId(service) === c.serviceId
    ) as ServiceType;
  }

  /**
   * Gets the single service instance (or `undefined`) for a given folder.
   */
  getServiceInstance<
    T extends WorkspaceService<I>,
    I extends WorkspaceServiceInstance = WorkspaceServiceInstanceType<T>
  >(service: T, folder: vscode.WorkspaceFolder): I | undefined {
    const serviceInstances = this.getServiceInstances<T, I>(service, folder);
    return serviceInstances.length > 0 ? serviceInstances[0] : undefined;
  }

  /**
   * Gets the single service instance (or `undefined`) from the class for a given folder.
   */
  getServiceInstanceFromClass<
    T extends WorkspaceService<I>,
    I extends WorkspaceServiceInstance = WorkspaceServiceInstanceType<T>
  >(serviceClass: WorkspaceServiceConstructor<T>, folder: vscode.WorkspaceFolder): I | undefined {
    const service = this.getService(serviceClass);
    if (!service) return;
    return this.getServiceInstance(service, folder);
  }

  /**
   * Gets all instances of a given service, with an optional folder name.
   */
  getServiceInstances<
    T extends WorkspaceService<I>,
    I extends WorkspaceServiceInstance = WorkspaceServiceInstanceType<T>
  >(service: T, folder?: vscode.WorkspaceFolder): I[] {
    const serviceInstances = folder
      ? this.workspaceServiceInstances.get(folder) || []
      : Array(...this.workspaceServiceInstances.values()).flat();
    return serviceInstances.filter(
      (instance) => this.instanceServices.get(instance) === service
    ) as I[];
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
    instanceToRemove.dispose();
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
