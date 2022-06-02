import { FrameLocator, Page } from '@playwright/test';

export default class InstructionsWebview {
  constructor(protected readonly page: Page) {}

  private get frame(): FrameLocator {
    return this.page
      .frameLocator('iframe.webview.ready')
      .frameLocator('iframe#active-frame')
      .first();
  }

  public async ready(): Promise<void> {
    await this.frame
      .locator('.qs')
      .first()
      .isVisible();
  }

  public async pageTitle(): Promise<string> {
    return this.frame.locator('.qs:visible header').innerText();
  }

  public async copyClipboardText(): Promise<void> {
    await this.frame.locator('.qs:visible .code-snippet button').click();
  }

  public async clickButton(label: string): Promise<void> {
    await this.frame.locator(`.qs:visible button:text("${label}")`).click();
  }
}
