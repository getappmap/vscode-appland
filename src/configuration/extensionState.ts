import * as vscode from 'vscode';
import { hasPreviouslyInstalledExtension } from '../util';

export const Keys = {
  Global: {
    INSTALL_GUIDE_VIEWED: 'appmap.applandinc.quickstartDocsSeen',
    INSTALL_TIMESTAMP: 'appmap.applandinc.installTimestamp',
    INSTALL_VERSION: 'appmap.applandinc.installVersion',
    SHOULD_VIEW_BETA_CTA: 'appmap.applandinc.shouldViewBetaCta',
  },
  Workspace: {
    CONFIGURED_AGENT: 'appmap.applandinc.agentConfigured',
    RECORDED_APPMAP: 'appmap.applandinc.recordedAppMap',
    OPENED_APPMAP: 'appmap.applandinc.workspaces_opened_appmap',
  },
};

interface WorkspaceFlagEvent {
  workspaceFolder: vscode.WorkspaceFolder;
  key: string;
  value: boolean;
}

export default class ExtensionState {
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
    } else {
      this._installTime = new Date();
      this._isNewInstall = !hasPreviouslyInstalledExtension(context.extensionPath);

      if (this._isNewInstall) {
        this.context.globalState.update(
          Keys.Global.INSTALL_VERSION,
          this.context.extension.packageJSON.version
        );
      }

      this.context.globalState.update(Keys.Global.INSTALL_TIMESTAMP, this._installTime.valueOf());
    }
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

    if (value) {
      if (!workspaces.has(fsPath)) {
        workspaces.add(fsPath);
        this._onWorkspaceFlag.fire({ workspaceFolder, key, value });
      }
    } else {
      workspaces.delete(fsPath);
    }

    this.context.globalState.update(key, [...workspaces]);
  }

  /** Returns whether or not the workspace folder at the given path exists in the set.
   */
  private getWorkspaceFlag(key: string, fsPath: string): boolean {
    const workspaceFolders = new Set<string>(this.context.globalState.get(key, []));
    return workspaceFolders.has(fsPath);
  }

  /** Returns whether or not the user has viewed the install guide. */
  get hasViewedInstallGuide(): boolean {
    return Boolean(this.context.globalState.get(Keys.Global.INSTALL_GUIDE_VIEWED, false));
  }

  set hasViewedInstallGuide(value: boolean) {
    this.context.globalState.update(Keys.Global.INSTALL_GUIDE_VIEWED, value);
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

  get shouldViewBetaCta(): boolean {
    return this.context.globalState.get<boolean>(Keys.Global.SHOULD_VIEW_BETA_CTA, true);
  }

  setShouldViewBetaCta(val: boolean): void {
    this.context.globalState.update(Keys.Global.SHOULD_VIEW_BETA_CTA, val);
  }

  /** Returns whether or not the user has recorded an AppMap from within the given workspace folder. */
  getWorkspaceRecordedAppMap(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.RECORDED_APPMAP, workspaceFolder.uri.fsPath);
  }

  setWorkspaceRecordedAppMap(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    return this.setWorkspaceFlag(Keys.Workspace.RECORDED_APPMAP, value, workspaceFolder);
  }

  /** Returns whether or not the user has opened an AppMap from within the given workspace folder. */
  getWorkspaceOpenedAppMap(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.OPENED_APPMAP, workspaceFolder.uri.fsPath);
  }

  setWorkspaceOpenedAppMap(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    return this.setWorkspaceFlag(Keys.Workspace.OPENED_APPMAP, value, workspaceFolder);
  }

  /** Returns whether or not the user has created an AppMap agent config (appmap.yml) */
  getWorkspaceConfiguredAgent(workspaceFolder: vscode.WorkspaceFolder): boolean {
    return this.getWorkspaceFlag(Keys.Workspace.CONFIGURED_AGENT, workspaceFolder.uri.fsPath);
  }

  setWorkspaceConfiguredAgent(workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.setWorkspaceFlag(Keys.Workspace.CONFIGURED_AGENT, value, workspaceFolder);
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
