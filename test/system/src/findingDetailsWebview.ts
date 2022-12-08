import { FrameLocator, Page } from '@playwright/test';
import { strictEqual } from 'assert';
import { waitFor } from '../../waitFor';

export default class FindingDetailsWebview {
  constructor(protected readonly page: Page) {}

  private frameSelector = 'iframe.webview.ready';
  private frame?: FrameLocator;
  private initializeErrorMsg = 'No frame found. Call initialize() first';

  public async assertTitleRenders(expectedTitle: string): Promise<void> {
    if (!this.frame) throw Error(this.initializeErrorMsg);

    const title = this.frame.locator('[data-cy="title"]');
    strictEqual(await title.count(), 1, 'Expected one title element');
    strictEqual(await title.innerText(), expectedTitle);
  }

  public async initialize(expectedFrames: number): Promise<void> {
    const checkForIFrames = async () => {
      const iframes = await this.page.locator(this.frameSelector).count();
      return iframes === expectedFrames;
    };

    await waitFor('waiting for second iframe', checkForIFrames.bind(this));
    // this assumes that the last iframe is the finding details page
    const outerFrame = this.page.frameLocator(this.frameSelector).last();
    await outerFrame.locator('iframe#active-frame').waitFor();
    this.frame = outerFrame.frameLocator('#active-frame');
  }
}
