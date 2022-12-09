import { Locator, Page } from '@playwright/test';
import FindingDetailsWebview from './findingDetailsWebview';
import FindingsOverviewWebview from './findingsOverviewWebview';
import InstructionsWebview from './instructionsWebview';

export enum InstructionStep {
  InstallAppMapAgent,
  RecordAppMaps,
  OpenAppMaps,
  GenerateOpenApi,
  InvestigateFindings,
}

export enum InstructionStepStatus {
  Pending,
  Complete,
  None,
}

export default class AppMap {
  constructor(
    protected readonly page: Page,
    protected readonly instructionsWebview: InstructionsWebview,
    protected readonly findingsOverviewWebview: FindingsOverviewWebview,
    protected readonly findingDetailsWebview: FindingDetailsWebview
  ) {}

  get actionPanelButton(): Locator {
    return this.page.locator('.action-item:has(a.action-label[aria-label="AppMap"])').first();
  }

  get pendingBadge(): Locator {
    return this.actionPanelButton.locator('.badge.progress-badge').first();
  }

  get instructionsTree(): Locator {
    return this.page.locator('.pane:has(.title:text("Instructions"))');
  }

  get findingsTree(): Locator {
    return this.page.locator('.pane:has(.title:text("Runtime Analysis"))');
  }

  get appMapTree(): Locator {
    return this.page.locator('.pane:has(.title:text("AppMaps"))');
  }

  public instructionsTreeItem(step: InstructionStep): Locator {
    return this.instructionsTree.locator('.pane-body >> [role="treeitem"]').nth(step);
  }

  public findingsTreeItem(nth?: number): Locator {
    return this.findingsTree.locator('.pane-body >> [role="treeitem"]').nth(nth || 0);
  }

  public finding(nth?: number): Locator {
    return this.findingsTree.locator('[role="treeitem"][aria-level="3"]').nth(nth || 0);
  }

  public appMapTreeItem(): Locator {
    return this.appMapTree.locator('.pane-body >> [role="treeitem"]:not([aria-expanded])').first();
  }

  public async expandFindings(): Promise<void> {
    if (await this.findingsTree.locator('.pane-body').isHidden()) {
      await this.findingsTree.click();
    }
  }

  public async openFindingsOverview(): Promise<void> {
    this.findingsTreeItem(0).click();
  }

  public openNthFinding(nth: number): void {
    this.finding(nth).click();
  }

  public async openActionPanel(): Promise<void> {
    await this.actionPanelButton.click();
    await this.ready();
  }

  public async ready(): Promise<void> {
    const welcomeView = await this.page.locator(
      '.split-view-view:has(.title:text("AppMaps")) >> .welcome-view'
    );
    await welcomeView.first().waitFor({ state: 'hidden' });
  }

  public async openInstruction(step: InstructionStep): Promise<void> {
    await this.instructionsTreeItem(step).click();
    await this.instructionsWebview.ready();
  }

  public async openAppMap(): Promise<void> {
    await this.appMapTreeItem().click();
  }

  public async assertInstructionStepStatus(
    step: InstructionStep,
    status: InstructionStepStatus
  ): Promise<void> {
    let selector = '.custom-view-tree-node-item-icon';
    switch (status) {
      case InstructionStepStatus.Complete:
        selector += '.codicon-pass-filled';
        break;

      case InstructionStepStatus.None:
        selector += '.codicon-circle-large-outline';
        break;

      default:
        selector += ':not(.codicon)';
        break;
    }

    return await this.instructionsTreeItem(step)
      .locator(selector)
      .waitFor();
  }
}
