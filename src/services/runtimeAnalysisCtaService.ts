import * as vscode from 'vscode';
import { OVERALL_SCORE_VALUES } from '../analyzers';
import { COMMAND_EARLY_ACCESS } from '../commands/getEarlyAccess';
import ExtensionSettings from '../configuration/extensionSettings';
import ExtensionState from '../configuration/extensionState';
import { CTA_DISMISS, CTA_VIEW, Telemetry } from '../telemetry';
import { NoopTreeDataProvider } from '../tree/noopTreeDataProvider';
import ProjectMetadata from '../workspace/projectMetadata';
import ChangeEventDebouncer from './changeEventDebouncer';
import { ProjectStateServiceInstance } from './projectStateService';
import { WorkspaceService, WorkspaceServiceInstance } from './workspaceService';

export const CTA_ID_EARLY_ACCESS_RT_ANALYSIS = 'early-access-runtime-analysis';

enum CtaPlacement {
  Sidebar = 'sidebar',
  Notification = 'notification',
}

export class RuntimeAnalysisCtaServiceInstance implements WorkspaceServiceInstance {
  protected disposables: vscode.Disposable[] = [];
  protected static FINDINGS_TREE_VIEW?: vscode.TreeView<vscode.TreeItem>;

  protected _eligible?: boolean | undefined;
  get eligible(): boolean | undefined {
    return this._eligible;
  }

  protected _onCheckEligibility = new ChangeEventDebouncer<boolean>();
  get onCheckEligibility(): vscode.Event<boolean> {
    return this._onCheckEligibility.event;
  }

  constructor(
    public folder: vscode.WorkspaceFolder,
    protected projectState: ProjectStateServiceInstance,
    protected extensionState: ExtensionState
  ) {
    if (ExtensionSettings.findingsEnabled()) {
      return;
    }

    this.disposables.push(
      projectState.onStateChange(async (metadata) => await this.notifyBetaEligibility(metadata))
    );

    this.initialize();
  }

  async initialize(): Promise<void> {
    // TODO: Not sure why we introduce a delay here?
    await this.notifyBetaEligibility(await this.projectState.metadata(), 5 * 1000);
  }

  protected async notifyBetaEligibility(metadata: ProjectMetadata, delay?: number): Promise<void> {
    this._eligible = Boolean(
      metadata.agentInstalled &&
        metadata.appMapsRecorded &&
        (metadata.language?.score || 0) >= OVERALL_SCORE_VALUES.good &&
        (metadata.webFramework?.score || 0) >= OVERALL_SCORE_VALUES.good
    );
    this._onCheckEligibility.fire(this.eligible as boolean);

    if (!this.eligible) return;

    RuntimeAnalysisCtaServiceInstance.displaySidebarCta();

    if (!this.extensionState.shouldViewBetaCta) return;

    if (delay !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    Telemetry.sendEvent(CTA_VIEW, {
      id: CTA_ID_EARLY_ACCESS_RT_ANALYSIS,
      placement: CtaPlacement.Notification,
    });

    const projectMsg =
      vscode.workspace.workspaceFolders?.length === 1
        ? 'this project'
        : `the project '${metadata.name}'`;

    const BUTTON_CONVERT = 'Get Early Access';
    const result = await vscode.window.showInformationMessage(
      `Runtime analysis is now supported for ${projectMsg}. Sign up for early access.`,
      BUTTON_CONVERT,
      'Dismiss'
    );

    this.extensionState.setShouldViewBetaCta(false);

    if (result === BUTTON_CONVERT) {
      vscode.commands.executeCommand(COMMAND_EARLY_ACCESS, CtaPlacement.Notification);
    } else {
      Telemetry.sendEvent(CTA_DISMISS, {
        id: CTA_ID_EARLY_ACCESS_RT_ANALYSIS,
        placement: CtaPlacement.Notification,
      });
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

export class RuntimeAnalysisCtaService implements WorkspaceService<WorkspaceServiceInstance> {
  protected _onCheckEligibility = new ChangeEventDebouncer<boolean>();
  get onCheckEligibility(): vscode.Event<boolean> {
    return this._onCheckEligibility.event;
  }

  constructor(
    protected projectStates: ReadonlyArray<ProjectStateServiceInstance>,
    protected extensionState: ExtensionState
  ) {}

  async create(folder: vscode.WorkspaceFolder): Promise<WorkspaceServiceInstance> {
    const projectState = this.projectStates.find((projectState) => projectState.folder === folder);
    if (!projectState) {
      throw new Error(`failed to resolve a project state for ${folder.name}`);
    }

    const instance = new RuntimeAnalysisCtaServiceInstance(
      folder,
      projectState,
      this.extensionState
    );
    instance.onCheckEligibility(this._onCheckEligibility.fire.bind(this));
    return instance;
  }
}
