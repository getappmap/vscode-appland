import * as vscode from 'vscode';
import { Disposable, EventEmitter, ExtensionContext } from 'vscode';
import RpcProcessWatcher from './rpcProcessWatcher';
import { ProgramName, getModulePath } from './nodeDependencyProcess';
import { NodeProcessService } from './nodeProcessService';
import { AppmapConfigManagerInstance } from './appmapConfigManager';
import { Client } from 'jayson/promise';
import { ConfigurationRpc, NavieRpc } from '@appland/rpc';
import { join } from 'path';
import { AUTHN_PROVIDER_NAME } from '../authentication';
import assert from 'assert';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import AssetService, { AssetIdentifier } from '../assets/assetService';
import { setSecretEnvVars } from './navieConfigurationService';
import ChatCompletion from './chatCompletion';

export type RpcConnect = (port: number) => Client;

const defaultRpcConnect: RpcConnect = (port) => Client.http({ port });

export interface RpcProcessServiceState {
  waitForStartup(): Promise<void>;

  killProcess(): void;
}

interface UpdateEnvOptions {
  // If an env var is set to undefined, it will be removed from the env.
  env?: Record<string, string | undefined>;
  secretEnv?: Record<string, string | undefined>;
}

export default class RpcProcessService implements Disposable {
  public readonly _onRpcPortChange = new EventEmitter<number | undefined>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;

  public rpcConnect: RpcConnect = defaultRpcConnect;

  private readonly processWatcher: RpcProcessWatcher;
  private rpcPort: number | undefined;
  private diposables: Disposable[] = [];
  private debounce?: NodeJS.Timeout;
  private restarting = false;
  private restartTimeout?: NodeJS.Timeout;

  public constructor(
    private readonly context: ExtensionContext,
    private readonly configServices: ReadonlyArray<AppmapConfigManagerInstance>,
    private readonly modulePath?: string
  ) {
    this.processWatcher = new RpcProcessWatcher(this.context, this.modulePath, {
      APPMAP_CODE_EDITOR: 'vscode',
      APPMAP_NAVIE_MODEL_SELECTOR: '1',
    });
    this.diposables.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.pushConfiguration()),
      this.processWatcher.onRpcPortChange((port) => this.onProcessStart(port)),
      ...this.configServices.map((instance) =>
        instance.onConfigChanged(async () => await this.pushConfiguration())
      ),
      this.processWatcher.onError(async (e) => {
        const log = this.processWatcher.process?.log.toString();
        Telemetry.sendEvent(DEBUG_EXCEPTION, {
          exception: e,
          errorCode: ErrorCode.ProcessFailure,
          version: await AssetService.getMostRecentVersion(AssetIdentifier.AppMapCli),
          log,
        });
      }),
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

  get onBeforeRestart(): vscode.Event<void> {
    return this.processWatcher.onBeforeRestart;
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

  public port(): number | undefined {
    return this.rpcPort;
  }

  public restart(): Promise<void> {
    return this.processWatcher.restart();
  }

  public restartDelay = 100;
  public debounceTime = 5000;

  public scheduleRestart() {
    if (this.debounce) {
      this.debounce.refresh();
    } else {
      this.debounce = setTimeout(() => this.debouncedRestart(), this.debounceTime).unref();
    }
  }

  public debouncedRestart(): void {
    if (this.restarting) this.scheduleRestart();
    else if (!this.restartTimeout) {
      // Add a small delay before triggering the restart to allow bulk configuration changes to
      // propagate without triggering a longer debounce timeout.
      this.restartTimeout = setTimeout(() => {
        this.debounce = undefined;
        this.restarting = true;
        this.restartTimeout = undefined;
        this.restart().finally(() => (this.restarting = false));
      }, this.restartDelay).unref();
    } /* else {
      There's already a pending restart, so we don't need to do anything.
    } */
  }

  rpcClient(): Client {
    if (!this.available) throw new Error('RPC server is not available');
    if (this.rpcPort === undefined) throw new Error('RPC port is not defined');
    return this.rpcConnect(this.rpcPort);
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

    const pushConfigurationV1 = async () =>
      rpcClient.request(ConfigurationRpc.V1.Set.Method, {
        appmapConfigFiles,
      });

    const pushConfigurationV2 = async () =>
      rpcClient.request(ConfigurationRpc.V2.Set.Method, {
        appmapConfigFiles,
        projectDirectories,
      });

    const configurationFn = (await isV2ConfigurationSupported())
      ? pushConfigurationV2
      : pushConfigurationV1;

    const chatCompletion = await ChatCompletion.instance;
    const copilotModels = ChatCompletion.models;
    if (copilotModels.length) {
      const models = copilotModels.map((model) => ({
        name: model.name,
        id: model.id,
        provider: 'Copilot',
        createdAt: new Date().toISOString(),
        baseUrl: chatCompletion?.url,
        apiKey: chatCompletion?.key,
        maxInputTokens: model.maxInputTokens,
      }));

      await rpcClient.request(NavieRpc.V1.Models.Add.Method, models).catch((e) => {
        NodeProcessService.outputChannel.appendLine(`Failed to add models: ${e}`);
      });
    }

    const modelId = await vscode.workspace.getConfiguration('appMap').get('selectedModel');
    if (modelId) {
      await rpcClient.request(NavieRpc.V1.Models.Select.Method, { id: modelId }).catch((e) => {
        NodeProcessService.outputChannel.appendLine(`Failed to set selected model: ${e}`);
      });
    }

    try {
      await configurationFn();
    } catch (e) {
      NodeProcessService.outputChannel.appendLine('Failed to sync AppMap configurations');
      if (e instanceof AggregateError) {
        e.errors.forEach((err) => NodeProcessService.outputChannel.appendLine(String(err)));
      } else {
        NodeProcessService.outputChannel.appendLine(String(e));
      }
    }
  }

  // The process has just started or restarted
  // The port has likely changed
  protected async onProcessStart(port: number) {
    this.rpcPort = port;
    await this.pushConfiguration();
    this._onRpcPortChange.fire(port);
  }

  public async restartServer(): Promise<void> {
    return this.processWatcher.restart();
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

  async updateEnv(change: UpdateEnvOptions): Promise<void> {
    let secretEnvChanged = false;
    if (change.secretEnv) {
      secretEnvChanged = await setSecretEnvVars(this.context, change.secretEnv);
    }

    if (change.env) {
      const env = vscode.workspace.getConfiguration('appMap').get('commandLineEnvironment', {});
      let envChanged = false;
      Object.entries(change.env).forEach(([k, v]) => {
        if (env[k] !== v) {
          envChanged = true;
          if (v !== undefined && v !== '') {
            env[k] = v;
          } else {
            delete env[k];
          }
        }
      });
      if (envChanged) {
        await vscode.workspace
          .getConfiguration('appMap')
          .update('commandLineEnvironment', env, true);
      }
    }

    if (secretEnvChanged) {
      this.debouncedRestart();
    }
  }
}
