import { Disposable, EventEmitter, ExtensionContext } from 'vscode';
import RpcProcessWatcher from './rpcProcessWatcher';
import { ProgramName, getModulePath } from './nodeDependencyProcess';
import { NodeProcessService } from './nodeProcessService';
import { AppmapConfigManagerInstance } from './appmapConfigManager';
import { Client } from 'jayson/promise';
import { ConfigurationRpc } from '@appland/rpc';
import { join } from 'path';

export default class RpcProcessService implements Disposable {
  public readonly _onRpcPortChange = new EventEmitter<number | undefined>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;

  private processWatcher?: RpcProcessWatcher;
  private rpcPort: number | undefined;
  private diposables: Disposable[] = [];
  private rpcClient?: Client;

  private constructor(
    private readonly context: ExtensionContext,
    private readonly configServices: ReadonlyArray<AppmapConfigManagerInstance>,
    private readonly modulePath?: string
  ) {
    if (this.modulePath) {
      this.processWatcher = new RpcProcessWatcher(this.context, this.modulePath);
      this.diposables.push(
        this.processWatcher.onRpcPortChange((port) => this.onProcessStart(port))
      );
    }

    this.diposables.push(
      ...this.configServices.map((instance) =>
        instance.onConfigChanged(() => this.syncAppMapConfigurations())
      )
    );
  }

  public get available(): boolean {
    return Boolean(this.rpcPort) && Boolean(this.processWatcher?.running);
  }

  public async port(): Promise<number | undefined> {
    return this.rpcPort;
  }

  private get appmapConfigFiles(): string[] {
    return this.configServices.flatMap((instance) =>
      instance.workspaceConfigs.map(({ configFolder }) => join(configFolder, 'appmap.yml'))
    );
  }

  private syncAppMapConfigurations(): void {
    if (!this.available) return;

    const { appmapConfigFiles } = this;

    NodeProcessService.outputChannel.appendLine(
      [
        'Syncing AppMap configurations:',
        appmapConfigFiles.length
          ? appmapConfigFiles.map((file) => `- ${file}`).join('\n')
          : '** NO CONFIGURATIONS AVAILABLE **',
      ].join('\n')
    );

    this.rpcClient?.request(ConfigurationRpc.SetFunctionName, {
      appmapConfigFiles,
    });
  }

  // The process has just started or restarted
  // The port has likely changed
  private onProcessStart(port: number): void {
    this.rpcClient = Client.http({ port });
    this.rpcPort = port;
    this.syncAppMapConfigurations();
    this._onRpcPortChange.fire(port);
  }

  private waitForStartup(): Promise<void> {
    if (!this.processWatcher) return Promise.reject(new Error('RPC process not available'));
    if (this.processWatcher.running) return Promise.resolve();

    return new Promise((resolve, reject) => {
      // Wait for the first port change event
      const disposable = this.processWatcher?.onRpcPortChange(() => {
        disposable?.dispose();
        clearTimeout(timeout);
        resolve();
      });
      const timeout = setTimeout(() => {
        disposable?.dispose();
        reject(new Error('Timeout waiting for RPC port'));
      }, 60_000);
      this.processWatcher?.start();
    });
  }

  public static async create(
    context: ExtensionContext,
    configServices: ReadonlyArray<AppmapConfigManagerInstance>
  ): Promise<RpcProcessService> {
    let modulePath: string | undefined;
    try {
      modulePath = await getModulePath({
        dependency: ProgramName.Appmap,
        globalStoragePath: context.globalStorageUri.fsPath,
      });
    } catch (e) {
      NodeProcessService.outputChannel.appendLine('Failed obtain the module for the RPC server');
      NodeProcessService.outputChannel.appendLine(String(e));
    }

    const service = new RpcProcessService(context, configServices, modulePath);
    try {
      await service.waitForStartup();
    } catch (e) {
      NodeProcessService.outputChannel.appendLine('Failed to launch the RPC server');
      NodeProcessService.outputChannel.appendLine(String(e));
    }

    return service;
  }

  dispose(): void {
    this.processWatcher?.dispose();
    this._onRpcPortChange.dispose();
    this.diposables.forEach((d) => d.dispose());
  }
}
