import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

import * as vscode from 'vscode';
import ExtensionState, { Keys } from '../configuration/extensionState';
import { FileChangeEmitter } from './fileChangeEmitter';
import FindingsIndex from './findingsIndex';
import { ResolvedFinding } from './resolvedFinding';
import ProjectMetadata from '../workspace/projectMetadata';
import AppMapCollection from './appmapCollection';
import ChangeEventDebouncer from './changeEventDebouncer';
import ClassMapIndex from './classMapIndex';

import AnalysisManager from './analysisManager';
import AppMapLoader from './appmapLoader';
import { PROJECT_OPEN, Telemetry } from '../telemetry';
import { workspaceServices } from './workspaceServices';
import { AppmapConfigManager } from './appmapConfigManager';

export class ProjectStateServiceInstance implements WorkspaceServiceInstance {
  protected disposables: vscode.Disposable[] = [];
  protected _onStateChange = new ChangeEventDebouncer<ProjectMetadata>(1000);
  protected _metadata: ProjectMetadata = {
    name: this.folder.name,
    path: this.folder.uri.fsPath,
  };
  protected initialized = false;
  protected findingsIndexListener?: vscode.Disposable;

  public onStateChange = this._onStateChange.event;

  constructor(
    public readonly folder: vscode.WorkspaceFolder,
    protected readonly extensionState: ExtensionState,
    protected readonly appMapCollection: AppMapCollection,
    protected readonly classMapIndex: ClassMapIndex,
    configWatcher: FileChangeEmitter
  ) {
    this.disposables.push(
      this._onStateChange,
      this.appMapCollection.onUpdated((workspaceFolder) => {
        if (workspaceFolder === folder) {
          this.onUpdateAppMaps();
        }
      }),
      configWatcher.onCreate((uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder === folder) {
          this.onConfigurationCreated();
        }
      }),
      configWatcher.onDelete(async (uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (workspaceFolder === folder) {
          await this.syncConfigurationState();
        }
      }),
      this.classMapIndex.onChanged(async () => {
        this._onStateChange.fire(this._metadata);
      }),
      extensionState.onWorkspaceFlag((e) => {
        if (
          e.workspaceFolder === folder &&
          [Keys.Workspace.OPENED_APPMAP, Keys.Workspace.OPENED_NAVIE].includes(e.key)
        ) {
          this.updateMetadata();
        }
      }),
      AnalysisManager.onAnalysisToggled(() => this.setFindingsIndex(AnalysisManager.findingsIndex))
    );

    this.syncConfigurationState();
    this.updateMetadata();
  }

  public async initialize(): Promise<void> {
    await this.onUpdateAppMaps();
    Telemetry.sendEvent(PROJECT_OPEN, {
      rootDirectory: this.folder.uri.fsPath,
      project: this.metadata,
      uri: this.folder.uri,
    });
  }

  public setFindingsIndex(findingsIndex?: FindingsIndex): void {
    this.findingsIndexListener?.dispose();
    this.findingsIndexListener = findingsIndex?.onChanged((workspaceFolder) => {
      if (workspaceFolder === this.folder) {
        const findings = findingsIndex.uniqueFindingsForWorkspace(this.folder);
        this.onFindingsChanged(findings);
      }
    });
  }

  private get isAgentConfigured(): boolean {
    return this.extensionState.getWorkspaceConfiguredAgent(this.folder);
  }

  private get hasRecordedAppMaps(): boolean {
    return (this.metadata.numAppMaps || 0) > 0;
  }

  private get hasOpenedAppMap(): boolean {
    return this.extensionState.getWorkspaceOpenedAppMap(this.folder);
  }

  private get hasOpenedNavie(): boolean {
    return this.extensionState.getWorkspaceOpenedNavie(this.folder);
  }

  get metadata(): Readonly<ProjectMetadata> {
    return this._metadata as Readonly<ProjectMetadata>;
  }

  get complete(): boolean {
    return Boolean(
      this.isAgentConfigured && this.hasRecordedAppMaps && this._metadata?.openedNavie
    );
  }

  onFindingsChanged(findings: ResolvedFinding[]): void {
    vscode.commands.executeCommand('setContext', 'appmap.analysisPerformed', true);

    this._metadata.analysisPerformed = true;
    this._metadata.numFindings = findings.length;

    this._onStateChange.fire(this._metadata);
  }

  async onUpdateAppMaps(): Promise<void> {
    const appMaps = this.appMapCollection.allAppMapsForWorkspaceFolder(this.folder);
    this._metadata.numHttpRequests = this.countRoutes(appMaps);
    this._metadata.numAppMaps = appMaps.length;

    this.updateMetadata();
  }

  onConfigurationCreated(): void {
    if (!this.isAgentConfigured) {
      this.extensionState.setWorkspaceConfiguredAgent(this.folder, true);
    }

    this.updateMetadata();
  }

  private async configurationInWorkspace(): Promise<boolean> {
    const configManager = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      this.folder
    );
    return !!(configManager && configManager.hasConfigFile);
  }

  private async syncConfigurationState(): Promise<void> {
    const hasConfigFiles = await this.configurationInWorkspace();
    const hasConfigured = this.extensionState.getWorkspaceConfiguredAgent(this.folder);

    if (hasConfigFiles !== hasConfigured) {
      this.extensionState.setWorkspaceConfiguredAgent(this.folder, hasConfigFiles);
      this.updateMetadata();
    }
  }

  private countRoutes(appMaps: AppMapLoader[]): number {
    return appMaps.reduce((sum, { descriptor }) => sum + (descriptor.numRequests || 0), 0);
  }

  private updateMetadata(): void {
    this._metadata.agentInstalled = this.isAgentConfigured;
    this._metadata.appMapsRecorded = this.hasRecordedAppMaps || false;
    this._metadata.openedNavie = this.hasOpenedNavie || false;
    this._metadata.appMapOpened = this.hasOpenedAppMap || false;
    this._onStateChange.fire(this._metadata);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

export default class ProjectStateService implements WorkspaceService<ProjectStateServiceInstance> {
  public static readonly serviceId = 'ProjectStateService';

  constructor(
    protected extensionState: ExtensionState,
    protected readonly configWatcher: FileChangeEmitter,
    protected readonly appMapCollection: AppMapCollection,
    protected readonly classMapIndex: ClassMapIndex,
    protected readonly findingsIndex?: FindingsIndex
  ) {}

  public async create(folder: vscode.WorkspaceFolder): Promise<ProjectStateServiceInstance> {
    const project = new ProjectStateServiceInstance(
      folder,
      this.extensionState,
      this.appMapCollection,
      this.classMapIndex,
      this.configWatcher
    );
    await project.initialize();
    return project;
  }
}
