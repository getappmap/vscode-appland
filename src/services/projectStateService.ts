import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

import * as vscode from 'vscode';
import ExtensionState, { Keys } from '../configuration/extensionState';
import { FileChangeEmitter } from './fileChangeEmitter';
import FindingsIndex from './findingsIndex';
import { ResolvedFinding } from './resolvedFinding';
import { analyze, scoreValue, NodeVersion, SCORE_VALUES, AppMapSummary } from '../analyzers';
import ProjectMetadata from '../workspace/projectMetadata';
import AppMapCollection from './appmapCollection';
import ChangeEventDebouncer from './changeEventDebouncer';
import ClassMapIndex from './classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';

import glob from 'glob';
import { promisify } from 'util';
import AnalysisManager from './analysisManager';
import AppMapLoader from './appmapLoader';

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
  protected _metadata: ProjectMetadata = {
    name: this.folder.name,
    path: this.folder.uri.fsPath,
  };
  protected initialized = false;
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
      this.classMapIndex.onChanged(async () => {
        this._metadata.sampleCodeObjects = await this.classMapSelection();
        this._onStateChange.fire(this._metadata);
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
    this.updateMetadata();
  }

  public async initialize(): Promise<void> {
    await Promise.all([this.analyzeProject(), this.onAppMapCreated()]);
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

  get metadata(): Readonly<ProjectMetadata> {
    return this._metadata as Readonly<ProjectMetadata>;
  }

  // Returns true if the project is installable and the agent has yet to be configured or
  // AppMaps have yet to be recorded
  get installable(): boolean {
    return (
      this.metadata.score !== undefined &&
      this.metadata.score >= 2 &&
      !(this.isAgentConfigured && this.hasRecordedAppMaps && this.metadata.analysisPerformed)
    );
  }

  get supported(): boolean {
    return (
      (this.metadata.language?.score || 0) >= SCORE_VALUES.good &&
      ((this.metadata.webFramework?.score || 0) >= SCORE_VALUES.ok ||
        (this.metadata.testFramework?.score || 0) >= SCORE_VALUES.ok)
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

    this._metadata.analysisPerformed = true;
    this._metadata.numFindings = findings.length;
    this._metadata.findingsDomainCounts = this.countDomainsFromFindings(findings);

    this._onStateChange.fire(this._metadata);
  }

  countDomainsFromFindings(findings: ResolvedFinding[]): FindingsDomainCounts {
    const findingsDomainCounts = {
      maintainability: 0,
      performance: 0,
      stability: 0,
      security: 0,
    } as FindingsDomainCounts;

    findings.forEach((resolvedFinding) => {
      const domain = resolvedFinding.finding.impactDomain?.toLowerCase();
      if (domain) findingsDomainCounts[domain]++;
    });

    return findingsDomainCounts;
  }

  onAppMapCreated(): void {
    if (!this.hasRecordedAppMaps) {
      this.extensionState.setWorkspaceRecordedAppMap(this.folder, true);
    }

    const appMaps = this.appMapCollection.allAppMapsForWorkspaceFolder(this.folder);
    this._metadata.appMaps = this.getBestAppMaps(appMaps);
    this._metadata.numHttpRequests = this.countRoutes(appMaps);
    this._metadata.numAppMaps = appMaps.length;

    this._onStateChange.fire(this._metadata);
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

  private async analyzeProject(): Promise<void> {
    const analysis = await analyze(this.folder);

    this._metadata.hasNode = this.hasNode(analysis.nodeVersion);
    this._metadata.language = {
      name: analysis.features.lang.title,
      score: scoreValue(analysis.features.lang.score),
      text: analysis.features.lang.text,
    };
    this._metadata.score = analysis.score;

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

  private getBestAppMaps(appMaps: AppMapLoader[], maxCount = 10): AppMapSummary[] {
    return appMaps
      .map(({ descriptor }) => ({
        path: descriptor.resourceUri.fsPath,
        name: descriptor.metadata?.name as string,
        requests: descriptor.numRequests as number,
        sqlQueries: descriptor.numQueries as number,
        functions: descriptor.numFunctions as number,
      }))
      .sort((a, b) => {
        const scoreA = a.requests * 100 + a.sqlQueries * 100 + a.functions * 100;
        const scoreB = b.requests * 100 + b.sqlQueries * 100 + b.functions * 100;
        return scoreB - scoreA;
      })
      .slice(0, maxCount);
  }

  private countRoutes(appMaps: AppMapLoader[]): number {
    return appMaps.reduce((sum, { descriptor }) => sum + (descriptor.numRequests || 0), 0);
  }

  private updateMetadata(): void {
    this._metadata.agentInstalled = this.isAgentConfigured || false;
    this._metadata.appMapsRecorded = this.hasRecordedAppMaps || false;
    this._metadata.investigatedFindings = this.hasInvestigatedFindings || false;
    this._metadata.appMapOpened = this.hasOpenedAppMap || false;
    this._metadata.generatedOpenApi = this.hasGeneratedOpenApi || false;

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

  public async create(folder: vscode.WorkspaceFolder): Promise<ProjectStateServiceInstance> {
    const project = new ProjectStateServiceInstance(
      folder,
      this.extensionState,
      this.appMapCollection,
      this.classMapIndex,
      this.appMapWatcher,
      this.configWatcher
    );
    await project.initialize();
    return project;
  }
}
