import * as vscode from 'vscode';
import { AUTHN_PROVIDER_NAME } from '../authentication';
import ExtensionSettings from '../configuration/extensionSettings';
import FindingsDiagnosticsProvider from '../diagnostics/findingsDiagnosticsProvider';
import FindingsIndex from './findingsIndex';
import { FindingWatcher } from './findingWatcher';
import openFinding from '../commands/openFinding';
import { ProjectStateServiceInstance } from './projectStateService';
import ExtensionState from '../configuration/extensionState';
import { ResolvedFinding } from './resolvedFinding';
import { WorkspaceServices } from './workspaceServices';
import Environment from '../configuration/environment';

export interface AnalysisToggleEvent {
  enabled: boolean;
  userAuthenticated: boolean;
  findingsEnabled: boolean;
}

export default class AnalysisManager {
  private static disposables: Array<vscode.Disposable> = [];
  private static _findingsIndex?: FindingsIndex;
  private static findingsWatcher?: FindingWatcher;
  private static findingsDiagnosticsProvider?: FindingsDiagnosticsProvider;
  private static projectStates: ReadonlyArray<ProjectStateServiceInstance>;
  private static extensionState: ExtensionState;
  private static workspaceServices: WorkspaceServices;
  private static readonly _onAnalysisToggled = new vscode.EventEmitter<AnalysisToggleEvent>();
  private static readonly contextKeyAnalysisEnabled = 'appmap.analysisEnabled';
  private static readonly contextKeyUserAuthenticated = 'appmap.userAuthenticated';
  private static readonly contextKeyFindingsEnabled = 'appmap.findingsEnabled';

  private static _isAnalysisEnabled?: boolean;

  public static get isAnalysisEnabled(): boolean {
    return Boolean(this._isAnalysisEnabled);
  }

  public static get onAnalysisToggled(): vscode.Event<AnalysisToggleEvent> {
    return this._onAnalysisToggled.event;
  }

  public static get findingsIndex(): FindingsIndex | undefined {
    return this._findingsIndex;
  }

  public static async register(
    context: vscode.ExtensionContext,
    projectStates: ReadonlyArray<ProjectStateServiceInstance>,
    extensionState: ExtensionState,
    workspaceServices: WorkspaceServices
  ): Promise<void> {
    this.projectStates = projectStates;
    this.extensionState = extensionState;
    this.workspaceServices = workspaceServices;

    await this.updateAnalysisState();

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration('appMap.findingsEnabled')) return;
        this.updateAnalysisState();
      }),
      vscode.authentication.onDidChangeSessions((e) => {
        if (e.provider.id !== AUTHN_PROVIDER_NAME) return;
        this.updateAnalysisState();
      })
    );
  }

  private static async updateAnalysisState(): Promise<void> {
    const userAuthenticated = await this.isUserAuthenticated();
    const findingsEnabled = ExtensionSettings.findingsEnabled;
    const enabled = findingsEnabled && userAuthenticated;

    vscode.commands.executeCommand('setContext', this.contextKeyAnalysisEnabled, enabled);
    vscode.commands.executeCommand('setContext', this.contextKeyFindingsEnabled, findingsEnabled);
    vscode.commands.executeCommand(
      'setContext',
      this.contextKeyUserAuthenticated,
      userAuthenticated
    );

    if (this._isAnalysisEnabled !== enabled) {
      this._isAnalysisEnabled = enabled;
      enabled ? this.onAnalysisEnabled() : this.onAnalysisDisabled();
      this._onAnalysisToggled.fire({ enabled, userAuthenticated, findingsEnabled });
    }
  }

  public static async isUserAuthenticated(): Promise<boolean> {
    if (Environment.isSmokeTest) return true;

    const session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
      createIfNone: false,
    });
    return session !== undefined;
  }

  private static onAnalysisEnabled(): void {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [openFinding(this.projectStates, this.extensionState)];

    this._findingsIndex = new FindingsIndex();

    this.findingsDiagnosticsProvider = new FindingsDiagnosticsProvider();
    this._findingsIndex.on('added', (uri: vscode.Uri, findings: ResolvedFinding[]) => {
      this.findingsDiagnosticsProvider?.updateFindings(uri, findings);
      vscode.commands.executeCommand('setContext', 'appmap.numFindings', findings.length);
    });
    this._findingsIndex.on('removed', (uri: vscode.Uri) => {
      this.findingsDiagnosticsProvider?.updateFindings(uri, []);
      const findings = this._findingsIndex?.findings();
      const numFindings = findings?.length || 0;
      vscode.commands.executeCommand('setContext', 'appmap.numFindings', numFindings);
    });

    const findingWatcher = new FindingWatcher();
    this.disposables.push(
      findingWatcher.onCreate(({ uri, workspaceFolder }) => {
        this._findingsIndex?.addFindingsFile(uri, workspaceFolder);
      }),
      findingWatcher.onChange(({ uri, workspaceFolder }) => {
        this._findingsIndex?.addFindingsFile(uri, workspaceFolder);
      }),
      findingWatcher.onDelete(({ uri, workspaceFolder }) => {
        this._findingsIndex?.removeFindingsFile(uri, workspaceFolder);
      })
    );

    this.workspaceServices.enroll(findingWatcher);
  }

  private static onAnalysisDisabled(): void {
    if (this._findingsIndex) {
      this._findingsIndex.removeAllListeners('added');
      this._findingsIndex.removeAllListeners('removed');
      this._findingsIndex.dispose();
      this._findingsIndex = undefined;
    }

    if (this.findingsWatcher) {
      this.workspaceServices.unenroll(this.findingsWatcher);
      this.findingsWatcher.dispose();
      this.findingsWatcher = undefined;
    }

    if (this.findingsDiagnosticsProvider) {
      this.findingsDiagnosticsProvider.dispose();
      this.findingsDiagnosticsProvider = undefined;
    }

    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
  }
}
