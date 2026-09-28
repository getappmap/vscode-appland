import * as vscode from 'vscode';
import Environment from '../configuration/environment';
import ExtensionSettings from '../configuration/extensionSettings';
import IndexProcessWatcher from './indexProcessWatcher';
import { getModulePath, ProgramName } from './nodeDependencyProcess';
import NodeProcessServiceInstance from './nodeProcessServiceInstance';
import { ProcessWatcher } from './processWatcher';
import ScanProcessWatcher from './scanProcessWatcher';
import { WorkspaceService } from './workspaceService';
import { AppmapConfigManager } from './appmapConfigManager';
import { workspaceServices } from './workspaceServices';
import assert from 'assert';
import AssetService from '../assets/assetService';
import { AssetIdentifier } from '../assets/types';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  public static readonly serviceId = 'NodeProcessService';
  public static outputChannel = vscode.window.createOutputChannel('AppMap: Services');

  protected static readonly DEFAULT_APPMAP_DIR = '.';

  // One config-change listener per folder, kept across rebuilds of the folder's instance.
  private readonly configListeners = new Map<vscode.WorkspaceFolder, vscode.Disposable>();
  // Rebuilds in flight, per folder. A second change during a rebuild queues one more
  // rebuild; further changes during that wait collapse into it.
  private readonly rebuilds = new Map<vscode.WorkspaceFolder, Promise<void>>();
  private readonly rebuildQueued = new Set<vscode.WorkspaceFolder>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  async create(folder: vscode.WorkspaceFolder): Promise<NodeProcessServiceInstance> {
    const services = await this.createServices(folder);
    const instance = new NodeProcessServiceInstance(folder, services);
    instance.initialize();

    const configManagerInstance = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    );
    assert(configManagerInstance);

    this.configListeners.get(folder)?.dispose();
    this.configListeners.set(
      folder,
      configManagerInstance.onConfigChanged(() =>
        this.handleConfigChange(folder).catch((e) =>
          NodeProcessService.outputChannel.appendLine(
            `Failed to restart AppMap services for ${folder.uri.fsPath}: ${String(e)}`
          )
        )
      )
    );

    return instance;
  }

  dispose(): void {
    this.configListeners.forEach((listener) => listener.dispose());
    this.configListeners.clear();
  }

  // Restart every instance of this service so it picks up a fresh environment
  // (see ExtensionSettings.appMapCommandLineEnvironment). Failures are logged
  // rather than propagated, so callers can safely fire-and-forget.
  async restartAll(reason: string): Promise<void> {
    NodeProcessService.outputChannel.appendLine(`${reason}. Restarting AppMap services.`);
    const instances = workspaceServices().getServiceInstancesFromClass(NodeProcessService);
    const results = await Promise.allSettled(instances.map((instance) => instance.restart(reason)));
    for (const result of results) {
      if (result.status === 'rejected') {
        NodeProcessService.outputChannel.appendLine(
          `Failed to restart AppMap service after ${reason}: ${result.reason}`
        );
      }
    }
  }

  // Rebuild the folder's processes after its configuration changed. Rebuilds for one folder
  // never overlap: overlapping rebuilds each stop the same old instance and each start a new
  // one, which leaks a full set of processes per extra change event.
  protected handleConfigChange(folder: vscode.WorkspaceFolder): Promise<void> {
    const inFlight = this.rebuilds.get(folder);
    if (inFlight) {
      if (this.rebuildQueued.has(folder)) return inFlight;
      this.rebuildQueued.add(folder);
      const next = inFlight
        .catch(() => undefined)
        .then(() => {
          this.rebuildQueued.delete(folder);
          return this.rebuildServices(folder);
        });
      this.rebuilds.set(folder, next);
      return next.finally(() => {
        if (this.rebuilds.get(folder) === next) this.rebuilds.delete(folder);
      });
    }

    const rebuild = this.rebuildServices(folder);
    this.rebuilds.set(folder, rebuild);
    return rebuild.finally(() => {
      if (this.rebuilds.get(folder) === rebuild) this.rebuilds.delete(folder);
    });
  }

  private async rebuildServices(folder: vscode.WorkspaceFolder): Promise<void> {
    const services = workspaceServices();
    // Stop every instance the folder has, not only the first one found.
    const currentInstances = services.getServiceInstancesFromClass(NodeProcessService, folder);
    for (const instance of currentInstances) {
      await instance.stop();
      services.unenrollServiceInstance(folder, instance);
    }

    const newServices = await this.createServices(folder);
    const newInstance = new NodeProcessServiceInstance(folder, newServices);
    newInstance.initialize();
    services.enrollServiceInstance(folder, newInstance, this);
  }

  private async createServices(folder: vscode.WorkspaceFolder): Promise<ProcessWatcher[]> {
    const services: ProcessWatcher[] = [];

    const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    );
    assert(appmapConfigManagerInstance);

    const appmapConfigs = appmapConfigManagerInstance.workspaceConfigs;

    const env =
      Environment.isSystemTest || Environment.isIntegrationTest
        ? { ...process.env, APPMAP_WRITE_PIDFILE: 'true' }
        : undefined;

    const appmapModulePath = getModulePath(ProgramName.Appmap);
    const appmapBinPath = AssetService.getAssetPath(AssetIdentifier.AppMapCli);
    appmapConfigs.forEach((appmapConfig) => {
      services.push(
        new IndexProcessWatcher(
          this.context,
          appmapModulePath,
          appmapBinPath,
          appmapConfig.appmapDir,
          appmapConfig.configFolder,
          env
        )
      );
    });

    if (ExtensionSettings.scannerEnabled) {
      const scannerModulePath = getModulePath(ProgramName.Scanner);
      const scannerBinPath = AssetService.getAssetPath(AssetIdentifier.ScannerCli);
      appmapConfigs.forEach((appmapConfig) => {
        services.push(
          new ScanProcessWatcher(
            this.context,
            scannerModulePath,
            scannerBinPath,
            appmapConfig.appmapDir,
            appmapConfig.configFolder,
            env
          )
        );
      });
    }

    return services;
  }
}
