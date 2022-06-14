import { Locator, Page } from '@playwright/test';

export default class Panel {
  constructor(protected readonly page: Page) {}

  private get panel(): Locator {
    return this.page.locator('.panel[id="workbench.parts.panel"]');
  }

  public get problems(): Locator {
    return this.panel.locator('.markers-panel-container');
  }

  public async open(): Promise<void> {
    await this.panel.click();
  }

  public async close(): Promise<void> {
    await this.panel.click();
  }
}
