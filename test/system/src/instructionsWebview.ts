import { FrameLocator, Locator, Page } from '@playwright/test';

export default class InstructionsWebview {
  constructor(protected readonly page: Page) {}

  private frameSelector = 'iframe.webview.ready';

  private get frame(): FrameLocator {
    return (
      this.page
        .frameLocator(this.frameSelector)
        // this assumes that the first iframe is the instructions page
        .first()
        .frameLocator('#active-frame')
    );
  }

  public get currentPage(): Locator {
    return this.frame.locator('.qs:visible').first();
  }

  public getPageByTitle(title: string): Locator {
    return this.currentPage.locator('header, .qs-step__head').locator(`text="${title}"`).first();
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
    await this.frame.locator(`.qs:visible button:has-text("${label}"):visible >> nth=0`).click();
  }

  public async selectProjectPickerRow(projectName: string): Promise<void> {
    await this.page.keyboard.press('Escape');
    const row = this.frame.locator(`.qs:visible div.project-picker-row:has-text("${projectName}")`);
    await row.evaluate((el) => {
      const element = el as HTMLElement;
      element.click();
    });
  }
}
