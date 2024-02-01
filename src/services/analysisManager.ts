import * as vscode from 'vscode';
import { AUTHN_PROVIDER_NAME, getApiKey } from '../authentication';
import FindingsDiagnosticsProvider from '../diagnostics/findingsDiagnosticsProvider';
import FindingsIndex from './findingsIndex';
import openFinding from '../commands/openFinding';
import ExtensionState from '../configuration/extensionState';
import { ResolvedFinding } from './resolvedFinding';
import Environment from '../configuration/environment';
import { debuglog } from 'util';
import Watcher from './watcher';

const debug = debuglog('appmap-vscode:AnalysisManager');

export interface AnalysisToggleEvent {
  enabled: boolean;
  userAuthenticated: boolean;
}

export default class AnalysisManager {
  private static disposables: Array<vscode.Disposable> = [];
  private static _findingsIndex?: FindingsIndex;
  private static findingsWatcher?: Watcher;
  private static findingsDiagnosticsProvider?: FindingsDiagnosticsProvider;
  private static extensionState: ExtensionState;
  // TODO: It's unclear when and how to dispose of this, since everything in this class is static.
  private static readonly _onAnalysisToggled = new vscode.EventEmitter<AnalysisToggleEvent>();
  private static readonly contextKeyAnalysisEnabled = 'appmap.analysisEnabled';
  private static readonly contextKeyUserAuthenticated = 'appmap.userAuthenticated';

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
    extensionState: ExtensionState
  ): Promise<void> {
    this.extensionState = extensionState;

    await this.updateAnalysisState();

    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions((e) => {
        if (e.provider.id !== AUTHN_PROVIDER_NAME) return;

        // The API key won't be available immediately. Wait a tick.
        setTimeout(this.updateAnalysisState.bind(this), 0);
      })
    );
  }

  private static async updateAnalysisState(): Promise<void> {
    const userAuthenticated = await this.isUserAuthenticated();
    const enabled = userAuthenticated;

    vscode.commands.executeCommand('setContext', this.contextKeyAnalysisEnabled, enabled);
    vscode.commands.executeCommand(
      'setContext',
      this.contextKeyUserAuthenticated,
      userAuthenticated
    );

    debug('updateAnalysisState(); userAuthenticated=%o', userAuthenticated);

    if (this._isAnalysisEnabled !== enabled) {
      this._isAnalysisEnabled = enabled;

      if (enabled) {
        this.onAnalysisEnabled();
      } else {
        this.onAnalysisDisabled();
      }

      this._onAnalysisToggled.fire({ enabled, userAuthenticated });
    }
  }

  public static async isUserAuthenticated(): Promise<boolean> {
    if (Environment.isSystemTest) return true;

    return !!(await getApiKey(false));
  }

  private static onAnalysisEnabled(): void {
    debug('onAnalysisEnabled()');
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [openFinding(this.extensionState)];

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

    const findingWatcher = new Watcher('**/appmap-findings.json');
    this.disposables.push(
      findingWatcher.onCreate((uri) => {
        this._findingsIndex?.addFindingsFile(uri);
      }),
      findingWatcher.onChange((uri) => {
        this._findingsIndex?.addFindingsFile(uri);
      }),
      findingWatcher.onDelete((uri) => {
        this._findingsIndex?.removeFindingsFile(uri);
      })
    );

    this.findingsWatcher = findingWatcher;
  }

  private static onAnalysisDisabled(): void {
    debug('onAnalysisDisabled()');
    if (this._findingsIndex) {
      this._findingsIndex.removeAllListeners('added');
      this._findingsIndex.removeAllListeners('removed');
      this._findingsIndex.dispose();
      this._findingsIndex = undefined;
    }

    if (this.findingsWatcher) {
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
