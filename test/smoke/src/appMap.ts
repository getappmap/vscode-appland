import { Locator, Page } from '@playwright/test';
import InstructionsWebview from './instructionsWebview';

export enum InstructionStep {
  InstallAppMapAgent,
  RecordAppMaps,
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
    protected readonly instructionsWebview: InstructionsWebview
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

  public instructionsTreeItem(step: InstructionStep): Locator {
    return this.instructionsTree.locator('.pane-body >> [role="treeitem"]').nth(step);
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
