import * as vscode from 'vscode';
import { hasPreviouslyInstalledExtension } from '../util';

export const Keys = {
  Global: {
    INSTALL_TIMESTAMP: 'appmap.applandinc.installTimestamp',
    INSTALL_VERSION: 'appmap.applandinc.installVersion',
    ANALYSIS_CTA_DISMISSED: 'appmap.applandinc.analysisCTADismissed',
    FIRST_MAP_NOTIFICATION_SHOWN: 'appmap.applandinc.firstAppMapNotificationShown',
  },
  Workspace: {
    CONFIGURED_AGENT: 'appmap.applandinc.agentConfigured',
    RECORDED_APPMAP: 'appmap.applandinc.recordedAppMap',
    OPENED_APPMAP: 'appmap.applandinc.workspaces_opened_appmap',
    OPENED_ANALYSIS: 'appmap.applandinc.workspaces_opened_analysis',
    OPENED_NAVIE: 'appmap.applandinc.workspaces_opened_navie',
    HIDE_INSTALL_PROMPT: 'appmap.applandinc.hideInstallPrompt',
    CLOSED_APPMAP: 'appmap.applandinc.closedAppMap',
    UPDATED_RUN_CONFIG: 'appmap.applandinc.UpdatedLaunchConfig',
    UPDATED_TEST_CONFIG: 'appmap.applandinc.UpdatedTestConfig',
  },
};

interface WorkspaceFlagEvent {
  workspaceFolder: vscode.WorkspaceFolder;
  key: string;
  value: boolean;
}

export default class ExtensionState implements vscode.Disposable {
  private readonly _onWorkspaceFlag = new vscode.EventEmitter<WorkspaceFlagEvent>();
  public readonly onWorkspaceFlag = this._onWorkspaceFlag.event;

  private readonly context: vscode.ExtensionContext;
  private readonly _installTime: Date;
  private _isNewInstall = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;

    const timestamp: string | undefined = this.context.globalState.get(
      Keys.Global.INSTALL_TIMESTAMP
    );

    if (timestamp) {
      this._installTime = new Date(parseInt(timestamp, 10));
      if (!this.context.globalState.get(Keys.Global.INSTALL_VERSION)) {
        this.context.globalState.update(Keys.Global.INSTALL_VERSION, this.packageVersion);
      }
    } else {
      this._installTime = new Date();
      this._isNewInstall = !hasPreviouslyInstalledExtension(context.extensionPath);

      if (this._isNewInstall) {
        this.context.globalState.update(Keys.Global.INSTALL_VERSION, this.packageVersion);
      }

      this.context.globalState.update(Keys.Global.INSTALL_TIMESTAMP, this._installTime.valueOf());
    }
    context.subscriptions.push(this);
  }

  /** Adds a workspace to a set under a specific key. If value is truthy, the path is added. Otherwise, it is removed
   * (if available).
   */
  private setWorkspaceFlag(
    key: string,
    value: boolean,
    workspaceFolder: vscode.WorkspaceFolder
  ): void {
    const { fsPath } = workspaceFolder.uri;
    const workspaces = new Set<string>(this.context.globalState.get(key, []));
    let changed = true;

    if (value) {
      if (!workspaces.has(fsPath)) {
        workspaces.add(fsPath);
      } else {
        changed = false;
      }
    } else {
      workspaces.delete(fsPath);
    }

    this.context.globalState.update(key, [...workspaces]);

    if (changed) this._onWorkspaceFlag.fire({ workspaceFolder, key, value });
  }

  /** Returns whether or not the workspace folder at the given path exists in the set.
   */
  private getWorkspaceFlag(key: string, fsPath: string): boolean {
    const workspaceFolders = new Set<string>(this.context.globalState.get(key, []));
    return workspaceFolders.has(fsPath);
  }

  /**
   * Gets the current version of this extension.
   */
  get packageVersion(): string {
    return this.context.extension.packageJSON.version;
  }

  get firstAppMapNotificationShown(): boolean {
    return Boolean(this.context.globalState.get(Keys.Global.FIRST_MAP_NOTIFICATION_SHOWN, false));
  }

  set firstAppMapNotificationShown(value: boolean) {
    this.context.globalState.update(Keys.Global.FIRST_MAP_NOTIFICATION_SHOWN, value);
  }

  get installTime(): Date {
    return this._installTime;
  }

  get isNewInstall(): boolean {
    return this._isNewInstall;
  }

  get firstVersionInstalled(): string {
    return this.context.globalState.get(Keys.Global.INSTALL_VERSION, 'unknown');
  }

  /** Returns whether or not the user has opened an AppMap from within the given workspace folder. */
  getWorkspaceOpenedAppMap(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.OPENED_APPMAP, workspaceFolder.uri.fsPath);
  }

  setWorkspaceOpenedAppMap(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    return this.setWorkspaceFlag(Keys.Workspace.OPENED_APPMAP, value, workspaceFolder);
  }

  /** Returns whether or not the user has opened Analysis page from within the given workspace folder. */
  getWorkspaceOpenedNavie(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.OPENED_NAVIE, workspaceFolder.uri.fsPath);
  }

  setWorkspaceOpenedNavie(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    return this.setWorkspaceFlag(Keys.Workspace.OPENED_NAVIE, value, workspaceFolder);
  }

  /** Returns whether or not the user has created an AppMap agent config (appmap.yml) */
  getWorkspaceConfiguredAgent(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.CONFIGURED_AGENT, workspaceFolder.uri.fsPath);
  }

  setWorkspaceConfiguredAgent(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.setWorkspaceFlag(Keys.Workspace.CONFIGURED_AGENT, value, workspaceFolder);
  }

  setHideInstallPrompt(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.setWorkspaceFlag(Keys.Workspace.HIDE_INSTALL_PROMPT, value, workspaceFolder);
  }

  getHideInstallPrompt(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.HIDE_INSTALL_PROMPT, workspaceFolder.uri.fsPath);
  }

  getClosedAppMap(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.CLOSED_APPMAP, workspaceFolder.uri.fsPath);
  }

  setClosedAppMap(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.setWorkspaceFlag(Keys.Workspace.CLOSED_APPMAP, value, workspaceFolder);
  }

  getUpdatedLaunchConfig(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.UPDATED_RUN_CONFIG, workspaceFolder.uri.fsPath);
  }

  setUpdatedLaunchConfig(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.setWorkspaceFlag(Keys.Workspace.UPDATED_RUN_CONFIG, value, workspaceFolder);
  }

  getUpdatedTestConfig(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.UPDATED_TEST_CONFIG, workspaceFolder.uri.fsPath);
  }

  setUpdatedTestConfig(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.setWorkspaceFlag(Keys.Workspace.UPDATED_TEST_CONFIG, value, workspaceFolder);
  }

  resetState(): void {
    Object.values(Keys)
      .flatMap((obj) => Object.values(obj))
      .forEach((key) => {
        this.context.globalState.update(key, undefined);
      });
  }

  dispose(): void {
    this._onWorkspaceFlag.dispose();
  }
}
