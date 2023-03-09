import { FrameLocator, Locator, Page } from '@playwright/test';
import { waitFor } from '../../waitFor';

export default class AppMapWebview {
  constructor(protected readonly page: Page) {}

  private frameSelector = 'iframe.webview.ready';
  private frame?: FrameLocator;
  private initializeErrorMsg = 'No frame found. Call initialize() first';

  public async initialize(expectedFrames: number): Promise<void> {
    const checkForIFrames = async () => {
      const iframes = await this.page.locator(this.frameSelector).count();
      return iframes === expectedFrames;
    };

    await waitFor('waiting for second iframe', checkForIFrames.bind(this));
    // this assumes that the last iframe is the appmap
    const outerFrame = this.page.frameLocator(this.frameSelector).last();
    await outerFrame.locator('iframe#active-frame').waitFor();
    this.frame = outerFrame.frameLocator('#active-frame');
    await this.frame.locator('#app').waitFor();
  }

  public async activeTab(): Promise<string> {
    if (!this.frame) throw Error(this.initializeErrorMsg);

    return await this.frame.locator('.tab-btn--active').innerText();
  }

  public get highlightedElement(): Locator {
    if (!this.frame) throw Error(this.initializeErrorMsg);

    return this.frame.locator('.highlight');
  }

  public async traceFilterValue(): Promise<string> {
    if (!this.frame) throw Error(this.initializeErrorMsg);

    return await this.frame.locator('.trace-filter__input').inputValue();
  }
}
