import { BrowserContext, ElectronApplication, Page } from '@playwright/test';
import AppMap from './appMap';
import InstructionsWebview from './instructionsWebview';
import Panel from './panel';
import { getOsShortcut } from './util';

export default class Driver {
  public readonly instructionsWebview = new InstructionsWebview(this.page);
  public readonly appMap = new AppMap(this.page, this.instructionsWebview);
  public readonly panel = new Panel(this.page);

  constructor(
    protected readonly app: ElectronApplication,
    protected readonly context: BrowserContext,
    protected readonly page: Page
  ) {}

  public async runCommand(cmd: string, allowMissing?: boolean): Promise<void> {
    await this.page.keyboard.press(getOsShortcut('Control+Shift+P'));
    await this.page.waitForSelector('.quick-input-box input', { state: 'visible' });
    await this.page.keyboard.type(cmd);
    await this.page.keyboard.press('Enter');
    if (allowMissing) {
      await this.page.keyboard.press('Escape');
    }
    await this.page.waitForSelector('.quick-input-box input', { state: 'hidden' });
  }

  public async waitForReady(): Promise<void> {
    await this.page
      .locator('.notification-toast:has(span:text("AppMap: Ready")) >> a[role="button"]:text("OK")')
      .click();
  }

  public async closeAllEditorWindows(): Promise<void> {
    await this.runCommand('View: Close All Editors');
  }

  public async resetUsage(): Promise<void> {
    await this.runCommand('AppMap: Reset usage state');
  }

  public async closePanel(): Promise<void> {
    await this.runCommand('View: Close Panel', true);
  }

  public async reload(): Promise<void> {
    await this.openActionView('Explorer');
    await this.closeAllEditorWindows();
    await this.runCommand('Developer: Reload Window');
    await this.waitForReady();
  }

  public async openActionView(name: string): Promise<void> {
    await this.page
      .locator(`.action-item  a.action-label[aria-label~="${name}"]`)
      .first()
      .click();
  }

  public async tabCount(): Promise<number> {
    return await this.page.locator('.tabs-and-actions-container >> [role="tab"]').count();
  }
}