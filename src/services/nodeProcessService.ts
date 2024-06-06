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
import AssetService, { AssetIdentifier } from '../assets/assetService';

export class NodeProcessService implements WorkspaceService<NodeProcessServiceInstance> {
  public static readonly serviceId = 'NodeProcessService';
  public static outputChannel = vscode.window.createOutputChannel('AppMap: Services');

  protected static readonly DEFAULT_APPMAP_DIR = '.';

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

    configManagerInstance.onConfigChanged(async () => this.handleConfigChange(folder));

    return instance;
  }

  private async handleConfigChange(folder: vscode.WorkspaceFolder): Promise<void> {
    const currentInstance = workspaceServices().getServiceInstanceFromClass(
      NodeProcessService,
      folder
    );
    assert(currentInstance);

    await currentInstance.stop();
    workspaceServices().unenrollServiceInstance(folder, currentInstance);

    const newServices = await this.createServices(folder);
    const newInstance = new NodeProcessServiceInstance(folder, newServices);
    newInstance.initialize();
    workspaceServices().enrollServiceInstance(folder, newInstance, this);
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
