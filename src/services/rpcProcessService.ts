import * as vscode from 'vscode';
import { Disposable, EventEmitter, ExtensionContext } from 'vscode';
import RpcProcessWatcher from './rpcProcessWatcher';
import { ProgramName, getModulePath } from './nodeDependencyProcess';
import { NodeProcessService } from './nodeProcessService';
import { AppmapConfigManagerInstance } from './appmapConfigManager';
import { Client } from 'jayson/promise';
import { ConfigurationRpc } from '@appland/rpc';
import { join } from 'path';
import { AUTHN_PROVIDER_NAME } from '../authentication';

export default class RpcProcessService implements Disposable {
  public readonly _onRpcPortChange = new EventEmitter<number | undefined>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;

  private readonly processWatcher: RpcProcessWatcher;
  private rpcPort: number | undefined;
  private diposables: Disposable[] = [];
  private rpcClient?: Client;

  private constructor(
    private readonly context: ExtensionContext,
    private readonly configServices: ReadonlyArray<AppmapConfigManagerInstance>,
    private readonly modulePath?: string
  ) {
    this.processWatcher = new RpcProcessWatcher(this.context, this.modulePath);
    this.diposables.push(
      this.processWatcher.onRpcPortChange((port) => this.onProcessStart(port)),
      ...this.configServices.map((instance) =>
        instance.onConfigChanged(() => this.syncAppMapConfigurations())
      ),
      vscode.authentication.onDidChangeSessions((e) => {
        if (e.provider.id !== AUTHN_PROVIDER_NAME) return;

        // The API key won't be available immediately. Wait a tick.
        setTimeout(() => {
          NodeProcessService.outputChannel.appendLine(
            'Authentication changed. Restarting the RPC server'
          );
          this.processWatcher.restart();
        }, 0);
      })
    );
  }

  public get available(): boolean {
    return Boolean(this.rpcPort) && Boolean(this.processWatcher.running);
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

    try {
      this.rpcClient?.request(ConfigurationRpc.V1.Set.Method, {
        appmapConfigFiles,
      });
    } catch (e) {
      NodeProcessService.outputChannel.appendLine('Failed to sync AppMap configurations');
      NodeProcessService.outputChannel.appendLine(String(e));
    }
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
    if (this.processWatcher.running) return Promise.resolve();

    return new Promise((resolve, reject) => {
      // Wait for the first port change event
      const disposable = this.processWatcher.onRpcPortChange(() => {
        disposable?.dispose();
        clearTimeout(timeout);
        resolve();
      });
      const timeout = setTimeout(() => {
        disposable?.dispose();
        reject(new Error('Timeout waiting for RPC port'));
      }, 60_000);
      this.processWatcher.start();
    });
  }

  public static async create(
    context: ExtensionContext,
    configServices: ReadonlyArray<AppmapConfigManagerInstance>
  ): Promise<RpcProcessService> {
    const modulePath = getModulePath(ProgramName.Appmap);
    const service = new RpcProcessService(context, configServices, modulePath);
    try {
      await service.waitForStartup();
    } catch (e) {
      NodeProcessService.outputChannel.appendLine('Failed to launch the RPC server');
      NodeProcessService.outputChannel.appendLine(String(e));
    }

    context.subscriptions.push(service);

    return service;
  }

  dispose(): void {
    this.processWatcher.dispose();
    this._onRpcPortChange.dispose();
    this.diposables.forEach((d) => d.dispose());
  }
}
