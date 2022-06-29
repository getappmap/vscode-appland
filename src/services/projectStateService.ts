import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

import * as vscode from 'vscode';
import ExtensionState, { Keys } from '../configuration/extensionState';
import { FileChangeEmitter } from './fileChangeEmitter';
import FindingsIndex from './findingsIndex';
import { ResolvedFinding } from './resolvedFinding';
import { analyze, scoreValue } from '../analyzers';
import ProjectMetadata from '../workspace/projectMetadata';
import AppMapCollection from './appmapCollection';

interface DomainCounts {
  total: number;
  security: number;
  performance: number;
  maintainability: number;
  stability: number;
}

export class ProjectStateServiceInstance implements WorkspaceServiceInstance {
  protected disposables: vscode.Disposable[] = [];
  protected _onStateChange = new vscode.EventEmitter<ProjectStateServiceInstance>();
  protected _metadata?: ProjectMetadata;
  protected initialized = false;
  protected analysisPerformed = false;
  protected numFindings = 0;

  public onStateChange = this._onStateChange.event;

  protected domains: DomainCounts = {
    total: 0,
    security: 0,
    performance: 0,
    maintainability: 0,
    stability: 0,
  };

  constructor(
    public readonly folder: vscode.WorkspaceFolder,
    protected readonly extensionState: ExtensionState,
    protected readonly appMapCollection: AppMapCollection,
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
          await this.syncConfigurationState();
        }
      }),
      extensionState.onWorkspaceFlag((e) => {
        if (e.workspaceFolder === folder && e.key === Keys.Workspace.OPENED_APPMAP) {
          this.updateMetadata();
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

    this.syncConfigurationState();
  }

  private get isAgentConfigured(): boolean {
    return this.extensionState.getWorkspaceConfiguredAgent(this.folder);
  }

  private get hasRecordedAppMaps(): boolean {
    return this.extensionState.getWorkspaceRecordedAppMap(this.folder);
  }

  private get hasOpenedAppMap(): boolean {
    return this.extensionState.getWorkspaceOpenedAppMap(this.folder);
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

  // Counts unique findings for each category: Maintainability | Performance | Stability | Security
  // Determines uniqueness by hash
  countDomainsFromFindings(findings: ResolvedFinding[]): void {
    const uniqueDomainMap = new Map<string, Set<string>>();

    // Adds each finding hash to the set corrisponding to its domain
    findings.forEach((finding) => {
      const domain: string = finding.finding.impactDomain;
      let hashArray = uniqueDomainMap.get(domain);

      if (hashArray == undefined) {
        const newSet = new Set<string>();
        uniqueDomainMap.set(domain, newSet);
        hashArray = newSet;
      }
      hashArray.add(finding.finding.hash);
    });

    // Sets this.domain to corresponding values in uniqueDomainMap
    this.domains.maintainability = uniqueDomainMap.get('Maintainability')?.size || 0;
    this.domains.performance = uniqueDomainMap.get('Performance')?.size || 0;
    this.domains.stability = uniqueDomainMap.get('Stability')?.size || 0;
    this.domains.security = uniqueDomainMap.get('Security')?.size || 0;
    this.domains.total = findings.length;

    vscode.window.showInformationMessage(JSON.stringify(this.domains));
  }

  onFindingsChanged(findings: ResolvedFinding[]): void {
    this.analysisPerformed = true;
    this.numFindings = findings.length;
    this.updateMetadata();

    this.countDomainsFromFindings(findings);
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
    const existingConfigs = await vscode.workspace.findFiles(pattern, undefined, 1);
    return existingConfigs.length !== 0;
  }

  private async syncConfigurationState(): Promise<void> {
    const hasConfigFiles = await this.configurationInWorkspace();
    const hasConfigured = this.extensionState.getWorkspaceConfiguredAgent(this.folder);

    if (hasConfigFiles !== hasConfigured) {
      this.extensionState.setWorkspaceConfiguredAgent(this.folder, hasConfigFiles);
      this.updateMetadata();
    }
  }

  private async updateMetadata(): Promise<void> {
    const analysis = await analyze(this.folder, this.appMapCollection);
    this._metadata = {
      name: this.folder.name,
      path: this.folder.uri.fsPath,
      score: analysis.score,
      agentInstalled: this.isAgentConfigured || false,
      appMapsRecorded: this.hasRecordedAppMaps || false,
      analysisPerformed: this.analysisPerformed,
      appMapOpened: this.hasOpenedAppMap || false,
      numFindings: this.numFindings,
      numMaintainability: this.domains.maintainability,
      numPerformance: this.domains.performance,
      numSecurity: this.domains.security,
      numStability: this.domains.stability,
      language: {
        name: analysis.features.lang.title,
        score: scoreValue(analysis.features.lang.score) + 1,
        text: analysis.features.lang.text,
      },
      appMaps: analysis.appMaps,
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

export default class ProjectStateService implements WorkspaceService<ProjectStateServiceInstance> {
  constructor(
    protected extensionState: ExtensionState,
    protected readonly appMapWatcher: FileChangeEmitter,
    protected readonly configWatcher: FileChangeEmitter,
    protected readonly appMapCollection: AppMapCollection,
    protected readonly findingsIndex?: FindingsIndex
  ) {}

  public create(folder: vscode.WorkspaceFolder): ProjectStateServiceInstance {
    return new ProjectStateServiceInstance(
      folder,
      this.extensionState,
      this.appMapCollection,
      this.appMapWatcher,
      this.configWatcher,
      this.findingsIndex
    );
  }
}
