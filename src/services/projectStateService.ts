import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

import * as vscode from 'vscode';
import ExtensionState, { Keys } from '../configuration/extensionState';
import { FileChangeEmitter } from './fileChangeEmitter';
import FindingsIndex from './findingsIndex';
import { ResolvedFinding } from './resolvedFinding';
import { analyze, scoreValue, NodeVersion, SCORE_VALUES } from '../analyzers';
import ProjectMetadata from '../workspace/projectMetadata';
import AppMapCollection from './appmapCollection';
import ChangeEventDebouncer from './changeEventDebouncer';
import ClassMapIndex from './classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';

import glob from 'glob';
import { promisify } from 'util';
import AnalysisManager from './analysisManager';

type SimpleCodeObject = {
  name: string;
  path: string;
};

export type SampleCodeObjects = {
  httpRequests: SimpleCodeObject[];
  queries: SimpleCodeObject[];
};

export type FindingsDomainCounts = {
  maintainability: number;
  performance: number;
  stability: number;
  security: number;
};

export class ProjectStateServiceInstance implements WorkspaceServiceInstance {
  protected disposables: vscode.Disposable[] = [];
  protected _onStateChange = new ChangeEventDebouncer<ProjectMetadata>(1000);
  protected _metadata?: ProjectMetadata;
  protected initialized = false;
  protected analysisPerformed = false;
  protected numFindings = 0;
  protected findingsDomainCounts?: FindingsDomainCounts;
  protected findingsIndexListener?: vscode.Disposable;

  public onStateChange = this._onStateChange.event;

  private SUPPORTED_NODE_VERSIONS = [14, 16, 18];
  private NUMBER_OF_SAMPLE_CODE_OBJECTS = 5;

  constructor(
    public readonly folder: vscode.WorkspaceFolder,
    protected readonly extensionState: ExtensionState,
    protected readonly appMapCollection: AppMapCollection,
    protected readonly classMapIndex: ClassMapIndex,
    appMapWatcher: FileChangeEmitter,
    configWatcher: FileChangeEmitter
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
        if (
          e.workspaceFolder === folder &&
          [
            Keys.Workspace.OPENED_APPMAP,
            Keys.Workspace.FINDINGS_INVESTIGATED,
            Keys.Workspace.GENERATED_OPENAPI,
          ].includes(e.key)
        ) {
          this.updateMetadata();
        }
      }),
      AnalysisManager.onAnalysisToggled(() => this.setFindingsIndex(AnalysisManager.findingsIndex))
    );

    this.syncConfigurationState();
  }

  public setFindingsIndex(findingsIndex?: FindingsIndex): void {
    this.findingsIndexListener?.dispose();
    this.findingsIndexListener = findingsIndex?.onChanged((workspaceFolder) => {
      if (workspaceFolder === this.folder) {
        const findings = findingsIndex.findingsForWorkspace(this.folder);
        this.onFindingsChanged(findings);
      }
    });
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

  private get hasInvestigatedFindings(): boolean {
    return this.extensionState.getFindingsInvestigated(this.folder);
  }

  private get hasGeneratedOpenApi(): boolean {
    return this.extensionState.getWorkspaceGeneratedOpenApi(this.folder);
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

  async supported(): Promise<boolean> {
    const metadata = await this.metadata();
    return (
      (metadata.language?.score || 0) >= SCORE_VALUES.good &&
      ((metadata.webFramework?.score || 0) >= SCORE_VALUES.ok ||
        (metadata.testFramework?.score || 0) >= SCORE_VALUES.ok)
    );
  }

  get complete(): boolean {
    return (
      this.isAgentConfigured &&
      this.hasRecordedAppMaps &&
      this._metadata?.analysisPerformed === true &&
      this.hasGeneratedOpenApi
    );
  }

  onFindingsChanged(findings: ResolvedFinding[]): void {
    vscode.commands.executeCommand('setContext', 'appmap.analysisPerformed', true);
    this.analysisPerformed = true;
    this.numFindings = findings.length;
    this.findingsDomainCounts = this.countDomainsFromFindings(findings);
    this.updateMetadata();
  }

  countDomainsFromFindings(findings: ResolvedFinding[]): FindingsDomainCounts {
    const findingsDomainCounts = {
      maintainability: 0,
      performance: 0,
      stability: 0,
      security: 0,
    } as FindingsDomainCounts;

    findings.forEach((resolvedFinding) => {
      const domain = resolvedFinding.finding.impactDomain.toLowerCase();
      findingsDomainCounts[domain]++;
    });

    return findingsDomainCounts;
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
    const existingConfigs = await promisify(glob)(`${this.folder.uri.fsPath}/**/appmap.yml`);
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

  private async classMapSelection(): Promise<SampleCodeObjects> {
    const classMap = await this.classMapIndex.classMap();
    const httpRequests = classMap.find((entry) => entry.fqid.includes('HTTP'))?.children || [];
    const queries = classMap.find((entry) => entry.fqid.includes('Queries'))?.children || [];
    const sampleHTTPRequests = this.getSampleCodeObjects(httpRequests);
    const sampleQueries = this.getSampleCodeObjects(queries);

    return {
      httpRequests: sampleHTTPRequests,
      queries: sampleQueries,
    } as SampleCodeObjects;
  }

  private getSampleCodeObjects(classMap: CodeObjectEntry[]): SimpleCodeObject[] {
    const requestsWithOneAssociatedAppMap = classMap.filter((request) => {
      return request.appMapFiles.length === 1;
    });

    if (requestsWithOneAssociatedAppMap.length >= this.NUMBER_OF_SAMPLE_CODE_OBJECTS) {
      return this.simplifyCodeObjectEntries(
        requestsWithOneAssociatedAppMap.slice(0, this.NUMBER_OF_SAMPLE_CODE_OBJECTS)
      );
    }

    return this.simplifyCodeObjectEntries(classMap.slice(0, this.NUMBER_OF_SAMPLE_CODE_OBJECTS));
  }

  private simplifyCodeObjectEntries(classMap: CodeObjectEntry[]): Array<SimpleCodeObject> {
    return classMap.map((entry) => {
      return {
        name: entry.name.split(';')[0],
        path: entry.appMapFiles[0],
      } as SimpleCodeObject;
    });
  }

  private async updateMetadata(): Promise<void> {
    const analysis = await analyze(this.folder, this.appMapCollection);
    const sampleCodeObjects = await this.classMapSelection();
    this._metadata = {
      name: this.folder.name,
      path: this.folder.uri.fsPath,
      score: analysis.score,
      hasNode: this.hasNode(analysis.nodeVersion),
      agentInstalled: this.isAgentConfigured || false,
      appMapsRecorded: this.hasRecordedAppMaps || false,
      analysisPerformed: this.analysisPerformed,
      investigatedFindings: this.hasInvestigatedFindings || false,
      appMapOpened: this.hasOpenedAppMap || false,
      generatedOpenApi: this.hasGeneratedOpenApi || false,
      numFindings: this.numFindings,
      findingsDomainCounts: this.findingsDomainCounts,
      numHttpRequests: analysis.numHttpRequests,
      numAppMaps: analysis.numAppMaps,
      language: {
        name: analysis.features.lang.title,
        score: scoreValue(analysis.features.lang.score),
        text: analysis.features.lang.text,
      },
      appMaps: analysis.appMaps,
      sampleCodeObjects,
    };

    if (analysis.features.test) {
      this._metadata.testFramework = {
        name: analysis.features.test.title,
        score: scoreValue(analysis.features.test.score),
        text: analysis.features.test.text,
      };
    }

    if (analysis.features.web) {
      this._metadata.webFramework = {
        name: analysis.features.web.title,
        score: scoreValue(analysis.features.web.score),
        text: analysis.features.web.text,
      };
    }

    this._onStateChange.fire(this._metadata);
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  private hasNode(nodeVersion: NodeVersion | undefined): boolean {
    return !!(
      nodeVersion &&
      nodeVersion.major !== 0 &&
      this.SUPPORTED_NODE_VERSIONS.includes(nodeVersion.major)
    );
  }
}

export default class ProjectStateService implements WorkspaceService<ProjectStateServiceInstance> {
  constructor(
    protected extensionState: ExtensionState,
    protected readonly appMapWatcher: FileChangeEmitter,
    protected readonly configWatcher: FileChangeEmitter,
    protected readonly appMapCollection: AppMapCollection,
    protected readonly classMapIndex: ClassMapIndex,
    protected readonly findingsIndex?: FindingsIndex
  ) {}

  public create(folder: vscode.WorkspaceFolder): ProjectStateServiceInstance {
    return new ProjectStateServiceInstance(
      folder,
      this.extensionState,
      this.appMapCollection,
      this.classMapIndex,
      this.appMapWatcher,
      this.configWatcher
    );
  }
}
