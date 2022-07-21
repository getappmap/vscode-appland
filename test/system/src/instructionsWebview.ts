import { FrameLocator, Locator, Page } from '@playwright/test';

export default class InstructionsWebview {
  constructor(protected readonly page: Page) {}

  private get frame(): FrameLocator {
    return this.page
      .frameLocator('iframe.webview.ready')
      .frameLocator('iframe#active-frame')
      .first();
  }

  public get currentPage(): Locator {
    return this.frame.locator('.qs:visible').first();
  }

  public getPageByTitle(title: string): Locator {
    return this.currentPage
      .locator('header, .qs-step__head')
      .locator(`text="${title}"`)
      .first();
  }

  public async ready(): Promise<void> {
    await this.currentPage.waitFor();
  }

  public async pageTitle(): Promise<string> {
    return this.frame
      .locator('.qs:visible')
      .locator('header h1, [data-cy="title"]')
      .first()
      .innerText();
  }

  public async copyClipboardText(): Promise<void> {
    await this.frame.locator('.qs:visible .code-snippet button').click();
  }

  public async clickButton(label: string): Promise<void> {
    // This is hacky, but it works for now.
    // Hit escape to clear any notifications that may hide a button.
    await this.page.keyboard.press('Escape');
    await this.frame.locator(`.qs:visible button:text("${label}"):visible`).click();
  }
}
