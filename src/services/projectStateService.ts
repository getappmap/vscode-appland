import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';
import { FileChangeEmitter } from './fileChangeEmitter';
import FindingsIndex from './findingsIndex';
import { ResolvedFinding } from './resolvedFinding';
import { analyze, scoreValue } from '../analyzers';
import ProjectMetadata from '../workspace/projectMetadata';

export class ProjectStateServiceInstance implements WorkspaceServiceInstance {
  protected disposables: vscode.Disposable[] = [];
  protected _onStateChange = new vscode.EventEmitter<ProjectStateServiceInstance>();
  protected _metadata?: ProjectMetadata;
  protected initialized = false;
  protected analysisPerformed = false;
  protected numFindings = 0;

  public onStateChange = this._onStateChange.event;

  constructor(
    public readonly folder: vscode.WorkspaceFolder,
    protected readonly extensionState: ExtensionState,
    appMapWatcher: FileChangeEmitter,
    configWatcher: FileChangeEmitter,
    findingsIndex?: FindingsIndex
  ) {
    this.disposables.push(
      this._onStateChange,
      appMapWatcher.onChange(({ workspaceFolder }) => {
        if (workspaceFolder === folder) {
          this.onAppMapCreated();
        }
      }),
      appMapWatcher.onCreate(({ workspaceFolder }) => {
        if (workspaceFolder === folder) {
          this.onAppMapCreated();
        }
      }),
      configWatcher.onCreate(({ workspaceFolder }) => {
        if (workspaceFolder === folder) {
          this.onConfigurationCreated();
        }
      }),
      configWatcher.onDelete(async ({ workspaceFolder }) => {
        if (workspaceFolder === folder) {
          await this.onConfigurationDeleted();
        }
      })
    );

    if (findingsIndex) {
      findingsIndex.onChanged((workspaceFolder) => {
        if (workspaceFolder === folder) {
          const findings = findingsIndex.findingsForWorkspace(folder);
          this.onFindingsChanged(findings);
        }
      });
    }
  }

  private get isAgentConfigured(): boolean {
    return this.extensionState.getWorkspaceConfiguredAgent(this.folder);
  }

  private get hasRecordedAppMaps(): boolean {
    return this.extensionState.getWorkspaceRecordedAppMap(this.folder);
  }

  async metadata(): Promise<Readonly<ProjectMetadata>> {
    if (!this._metadata) {
      await this.updateMetadata();
    }

    return this._metadata as Readonly<ProjectMetadata>;
  }

  // Returns true if the project is installable and the agent has yet to be configured or
  // AppMaps have yet to be recorded
  async installable(): Promise<boolean> {
    const metadata = await this.metadata();
    return (
      metadata.score !== undefined &&
      metadata.score >= 2 &&
      !(this.isAgentConfigured && this.hasRecordedAppMaps && metadata.analysisPerformed)
    );
  }

  get complete(): boolean {
    return (
      this.isAgentConfigured &&
      this.hasRecordedAppMaps &&
      this._metadata?.analysisPerformed === true
    );
  }

  onFindingsChanged(findings: ResolvedFinding[]): void {
    this.analysisPerformed = true;
    this.numFindings = findings.length;
    this.updateMetadata();
  }

  onAppMapCreated(): void {
    if (!this.hasRecordedAppMaps) {
      this.extensionState.setWorkspaceRecordedAppMap(this.folder, true);
    }

    this.updateMetadata();
  }

  onConfigurationCreated(): void {
    if (!this.isAgentConfigured) {
      this.extensionState.setWorkspaceConfiguredAgent(this.folder, true);
    }

    this.updateMetadata();
  }

  private async configurationInWorkspace(): Promise<boolean> {
    const pattern = new vscode.RelativePattern(this.folder, '**/appmap.yml');
    const existingConfigs = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
    return existingConfigs.length !== 0;
  }

  async onConfigurationDeleted(): Promise<void> {
    const hasConfigFiles = await this.configurationInWorkspace();
    const hasConfigured = this.extensionState.getWorkspaceConfiguredAgent(this.folder);

    if (hasConfigFiles !== hasConfigured) {
      this.extensionState.setWorkspaceConfiguredAgent(this.folder, hasConfigFiles);
      this.updateMetadata();
    }
  }

  private async updateMetadata(): Promise<void> {
    const analysis = await analyze(this.folder);
    this._metadata = {
      name: this.folder.name,
      path: this.folder.uri.fsPath,
      score: analysis.score,
      agentInstalled: this.isAgentConfigured || false,
      appMapsRecorded: this.hasRecordedAppMaps || false,
      analysisPerformed: this.analysisPerformed,
      numFindings: this.numFindings,
      language: {
        name: analysis.features.lang.title,
        score: scoreValue(analysis.features.lang.score) + 1,
        text: analysis.features.lang.text,
      },
    };

    if (analysis.features.test) {
      this._metadata.testFramework = {
        name: analysis.features.test.title,
        score: scoreValue(analysis.features.test.score) + 1,
        text: analysis.features.test.text,
      };
    }

    if (analysis.features.web) {
      this._metadata.webFramework = {
        name: analysis.features.web.title,
        score: scoreValue(analysis.features.web.score) + 1,
        text: analysis.features.web.text,
      };
    }

    this._onStateChange.fire(this);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

export default class ProjectStateService implements WorkspaceService {
  constructor(
    protected extensionState: ExtensionState,
    protected readonly appMapWatcher: FileChangeEmitter,
    protected readonly configWatcher: FileChangeEmitter,
    protected readonly findingsIndex?: FindingsIndex
  ) {}

  public create(folder: vscode.WorkspaceFolder): ProjectStateServiceInstance {
    return new ProjectStateServiceInstance(
      folder,
      this.extensionState,
      this.appMapWatcher,
      this.configWatcher,
      this.findingsIndex
    );
  }
}
