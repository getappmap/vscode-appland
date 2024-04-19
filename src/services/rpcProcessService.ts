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
import assert from 'assert';

export type RpcConnect = (port: number) => Client;

const defaultRpcConnect: RpcConnect = (port) => Client.http({ port });

export interface RpcProcessServiceState {
  waitForStartup(): Promise<void>;

  killProcess(): void;
}

export default class RpcProcessService implements Disposable {
  public readonly _onRpcPortChange = new EventEmitter<number | undefined>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;

  public rpcConnect: RpcConnect = defaultRpcConnect;

  private readonly processWatcher: RpcProcessWatcher;
  private rpcPort: number | undefined;
  private diposables: Disposable[] = [];

  public constructor(
    private readonly context: ExtensionContext,
    private readonly configServices: ReadonlyArray<AppmapConfigManagerInstance>,
    private readonly modulePath?: string
  ) {
    this.processWatcher = new RpcProcessWatcher(this.context, this.modulePath);
    this.diposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.pushConfiguration()),
      this.processWatcher.onRpcPortChange((port) => this.onProcessStart(port)),
      ...this.configServices.map((instance) =>
        instance.onConfigChanged(async () => await this.pushConfiguration())
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

  // Provides some internal state access, primarily for testing purposes.
  public get state(): RpcProcessServiceState {
    return {
      waitForStartup: () => this.waitForStartup(),
      killProcess: () => this.processWatcher.process?.kill(),
    };
  }

  public get available(): boolean {
    return Boolean(this.rpcPort) && Boolean(this.processWatcher.running);
  }

  public async port(): Promise<number | undefined> {
    return this.rpcPort;
  }

  protected async pushConfiguration() {
    if (!this.available) return;

    const { appmapConfigFiles, projectDirectories } = this;
    assert(this.rpcPort !== undefined, 'RPC port is not defined');

    const rpcClient = this.rpcConnect(this.rpcPort);

    NodeProcessService.outputChannel.appendLine(
      [
        'Pushing workspace configuration to RPC server:',
        appmapConfigFiles.length
          ? appmapConfigFiles.map((file) => `- ${file}`).join('\n')
          : '** NO CONFIGURATIONS AVAILABLE **',
      ].join('\n')
    );

    const isV2ConfigurationSupported = async (): Promise<boolean> => {
      try {
        const response = await rpcClient.request(ConfigurationRpc.V2.Get.Method, {});
        return response.error === undefined;
      } catch (e) {
        return false;
      }
    };

    const pushConfigurationV1 = async () => {
      await rpcClient.request(ConfigurationRpc.V1.Set.Method, {
        appmapConfigFiles,
      });
    };

    const pushConfigurationV2 = async () => {
      await rpcClient.request(ConfigurationRpc.V2.Set.Method, {
        appmapConfigFiles,
        projectDirectories,
      });
    };

    const configurationFn = (await isV2ConfigurationSupported())
      ? pushConfigurationV2
      : pushConfigurationV1;

    try {
      await configurationFn();
    } catch (e) {
      NodeProcessService.outputChannel.appendLine('Failed to sync AppMap configurations');
      NodeProcessService.outputChannel.appendLine(String(e));
    }
  }

  // The process has just started or restarted
  // The port has likely changed
  protected async onProcessStart(port: number) {
    this.rpcPort = port;
    await this.pushConfiguration();
    this._onRpcPortChange.fire(port);
  }

  protected waitForStartup(): Promise<void> {
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

  private get appmapConfigFiles(): string[] {
    return this.configServices.flatMap((instance) =>
      instance.workspaceConfigs.map(({ configFolder }) => join(configFolder, 'appmap.yml'))
    );
  }

  private get projectDirectories(): string[] {
    return vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  }

  public static async create(
    context: ExtensionContext,
    configServices: ReadonlyArray<AppmapConfigManagerInstance>,
    modulePath = getModulePath(ProgramName.Appmap)
  ): Promise<RpcProcessService> {
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
