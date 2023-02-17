import { FrameLocator, Locator, Page } from '@playwright/test';

export default class AppMapWebview {
  constructor(protected readonly page: Page) {}

  private frameSelector = 'iframe.webview.ready';

  private get frame(): FrameLocator {
    return this.page.frameLocator(this.frameSelector).nth(1).frameLocator('#active-frame').first();
  }

  public get app(): Locator {
    return this.frame.locator('#app').first();
  }

  public async ready(): Promise<void> {
    await this.app.waitFor();
  }
}
