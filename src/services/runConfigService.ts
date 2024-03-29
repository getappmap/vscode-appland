import * as vscode from 'vscode';

import assert from 'assert';
import path from 'path';

import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';
import ProjectStateService, { ProjectStateServiceInstance } from './projectStateService';
import { WorkspaceServices } from './workspaceServices';
import ExtensionState from '../configuration/extensionState';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';

type JavaTestConfig = {
  name?: string;
  vmArgs?: Array<string>;
};

export enum RunConfigStatus {
  Pending,
  Success,
  Error,
}

type VmArgs = {
  vmArgs?: string | Array<string>;
};

const vmArgContainsAppMap = (vmArg: string | Array<string>, regex: RegExp): boolean =>
  typeof vmArg === 'string' ? regex.test(vmArg) : vmArg.some((arg) => regex.test(arg));

const configsContain = (regex: RegExp, configs?: Array<VmArgs>): boolean =>
  Boolean(configs?.some(({ vmArgs }) => vmArgs && vmArgContainsAppMap(vmArgs, regex)));

export class RunConfigServiceInstance implements WorkspaceServiceInstance {
  private static JAVA_TEST_RUNNER_EXTENSION_ID = 'vscjava.vscode-java-test';
  private static APPMAP_JAR_REGEX = /appmap-?(.*?)?.jar$/;
  private outputDirVmarg = '-Dappmap.output.directory=${command:appmap.getAppmapDir}';
  private testConfigName = 'Test with AppMap';
  private _status: RunConfigStatus;
  protected disposables: vscode.Disposable[] = [];

  public get appmapLaunchConfig(): vscode.DebugConfiguration {
    return {
      type: 'java',
      name: 'Run with AppMap',
      request: 'launch',
      mainClass: '',
      vmArgs: `-javaagent:${this.javaJarPath}`,
    };
  }

  public get appmapTestConfig(): JavaTestConfig {
    return {
      name: this.testConfigName,
      vmArgs: [`-javaagent:${this.javaJarPath}`, this.outputDirVmarg],
    };
  }

  public get hasPreviouslyUpdatedLaunchConfig(): boolean {
    return this.extensionState.getUpdatedLaunchConfig(this.folder);
  }

  public get hasPreviouslyUpdatedTestConfig(): boolean {
    return this.extensionState.getUpdatedTestConfig(this.folder);
  }

  private get javaJarPath(): string {
    return path.join('${userHome}', '.appmap', 'lib', 'java', 'appmap.jar');
  }

  constructor(
    public folder: vscode.WorkspaceFolder,
    public projectStateServiceInstance: ProjectStateServiceInstance,
    private extensionState: ExtensionState,
    private readonly _onStatusChange: vscode.EventEmitter<RunConfigServiceInstance>
  ) {
    this.disposables.push(
      vscode.extensions.onDidChange(this.updateConfigs.bind(this)),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration('java.test.config') ||
          e.affectsConfiguration('launch.configurations')
        ) {
          this.updateStatus();
        }
      })
    );

    this._status = RunConfigStatus.Pending;
    this.updateConfigs();
  }

  private async updateStatus(): Promise<void> {
    this.status = (await this.hasConfigs()) ? RunConfigStatus.Success : RunConfigStatus.Error;
  }

  public async updateConfigs(): Promise<void> {
    if (!this.isJavaProject()) return;
    if (!this.hasPreviouslyUpdatedLaunchConfig) await this.updateLaunchConfig();
    if (this.hasPreviouslyUpdatedTestConfig) {
      await this.updateExistingTestConfig();
    } else {
      await this.updateTestConfig();
    }

    this.updateStatus();
  }

  public async updateLaunchConfig(): Promise<void> {
    try {
      await this.updateConfig('launch', 'configurations', this.appmapLaunchConfig);
      this.extensionState.setUpdatedLaunchConfig(this.folder, true);
    } catch (e) {
      this.sendConfigUpdateError(e);
    }
  }

  public async updateTestConfig(): Promise<boolean> {
    if (this.hasJavaTestExtension()) {
      try {
        await this.updateConfig('java.test', 'config', this.appmapTestConfig);
        this.extensionState.setUpdatedTestConfig(this.folder, true);
        return true;
      } catch (e) {
        this.sendConfigUpdateError(e);
        return false;
      }
    }
    return false;
  }

  private async updateExistingTestConfig(): Promise<void> {
    if (this.hasJavaTestExtension()) {
      try {
        const parentConfig = vscode.workspace.getConfiguration('java.test');
        const configs = parentConfig.get<Array<JavaTestConfig>>('config');
        if (!configs || !Array.isArray(configs)) return;

        configs.forEach((config) => {
          if (
            config.name === this.testConfigName &&
            config.vmArgs &&
            !config.vmArgs.some((vmArg) => vmArg.includes('appmap.output.directory'))
          )
            config.vmArgs.push(this.outputDirVmarg);
        });

        await parentConfig.update('config', configs);
      } catch (e) {
        this.sendConfigUpdateError(e);
      }
    }
  }

  private async updateConfig(
    parentSection: string,
    section: string,
    appmapConfig: vscode.DebugConfiguration | JavaTestConfig
  ): Promise<void> {
    const parentConfig = vscode.workspace.getConfiguration(parentSection);
    let configs = parentConfig.get<Array<vscode.DebugConfiguration | JavaTestConfig>>(section);
    if (!Array.isArray(configs)) configs = [];

    configs.push(appmapConfig);
    await parentConfig.update(section, configs);
  }

  private isJavaProject(): boolean {
    const { language } = this.projectStateServiceInstance.metadata;
    return !!(language && language.name && language.name === 'Java');
  }

  public hasJavaTestExtension(): boolean {
    const extensions = vscode.extensions.all;
    return extensions.some(
      (exension) => exension.id === RunConfigServiceInstance.JAVA_TEST_RUNNER_EXTENSION_ID
    );
  }

  private sendConfigUpdateError(e: unknown): void {
    this.status = RunConfigStatus.Error;
    const err = e as Error;
    Telemetry.sendEvent(DEBUG_EXCEPTION, {
      exception: err,
      errorCode: ErrorCode.ConfigUpdateError,
    });
  }

  private set status(status: RunConfigStatus) {
    if (this.status === status) return;

    this._status = status;
    this._onStatusChange.fire(this);
  }

  public get status(): RunConfigStatus {
    return this._status;
  }

  public hasLaunchConfig(): boolean {
    const launchConfigs = vscode.workspace
      .getConfiguration('launch')
      .get<VmArgs[]>('configurations', []);
    return (
      Array.isArray(launchConfigs) &&
      configsContain(RunConfigServiceInstance.APPMAP_JAR_REGEX, launchConfigs)
    );
  }

  public hasTestConfig(): boolean {
    const testConfigs = vscode.workspace.getConfiguration('java.test').get<VmArgs[]>('config', []);
    return (
      Array.isArray(testConfigs) &&
      configsContain(RunConfigServiceInstance.APPMAP_JAR_REGEX, testConfigs)
    );
  }

  public async addMissingConfigs(): Promise<void> {
    if (!this.isJavaProject()) return;
    if (!this.hasLaunchConfig()) await this.updateLaunchConfig();
    if (!this.hasTestConfig()) await this.updateTestConfig();

    await this.updateStatus();
  }

  public hasConfigs(): boolean | undefined {
    return this.hasLaunchConfig() && this.hasTestConfig();
  }

  public async dispose(): Promise<void> {
    this.disposables.forEach((disposable) => disposable.dispose());
  }
}

export class RunConfigService implements WorkspaceService<RunConfigServiceInstance> {
  private static _onStatusChange = new vscode.EventEmitter<RunConfigServiceInstance>();
  public static readonly onStatusChange = RunConfigService._onStatusChange.event;
  public static readonly serviceId = 'RunConfigService';

  constructor(
    private projectStateService: ProjectStateService,
    private workspaceServices: WorkspaceServices,
    private extensionState: ExtensionState
  ) {}

  async create(folder: vscode.WorkspaceFolder): Promise<RunConfigServiceInstance> {
    const projectStateServiceInstance = this.workspaceServices.getServiceInstance(
      this.projectStateService,
      folder
    );
    assert(projectStateServiceInstance);

    return new RunConfigServiceInstance(
      folder,
      projectStateServiceInstance,
      this.extensionState,
      RunConfigService._onStatusChange
    );
  }

  static dispose(): void {
    this._onStatusChange.dispose();
  }
}
