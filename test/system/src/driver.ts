import { BrowserContext, ElectronApplication, Locator, Page } from '@playwright/test';
import { glob } from 'glob';
import AppMap from './appMap';
import InstructionsWebview from './instructionsWebview';
import Panel from './panel';
import { getOsShortcut } from './util';

async function tryClick(elem: Locator, timeout = 5000) {
  try {
    await elem.click({ timeout });
  } catch (err) {
    console.warn(`problem clicking ${elem}: ${err}`);
  }
}

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
    await this.page.press('body', getOsShortcut('Control+Shift+P'));

    const input = this.page.locator('.quick-input-box input');
    await input.type(cmd);
    await input.press('Enter');

    if (allowMissing) {
      await this.page.keyboard.press('Escape');
    }

    await input.waitFor({ state: 'hidden' });
  }

  public async waitForReady(): Promise<void> {
    await tryClick(
      this.page.locator('[id="status.notifications"] a[role="button"][aria-label="Notifications"]')
    );
    await tryClick(
      this.page.locator(
        '.notifications-list-container .monaco-list-row:has(span:text("AppMap: Ready")) >> a[role="button"]:text("OK")'
      )
    );
  }

  public async waitForFile(pattern: string): Promise<void> {
    const cwd = process.cwd();
    let retryCount = 0;
    for (;;) {
      if (retryCount > 30) {
        throw new Error(`timed out waiting for ${pattern} in ${cwd}`);
      }

      const fileFound = await new Promise((resolve) =>
        glob(pattern, (err, matches) => {
          if (err) {
            throw err;
          }
          resolve(matches.length > 0);
        })
      );

      if (fileFound) return;

      await new Promise((resolve) => setTimeout(resolve, 1000));
      retryCount += 1;
    }
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
