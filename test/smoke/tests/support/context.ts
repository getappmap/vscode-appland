import { BrowserContext, ElectronApplication, Page } from '@playwright/test';
import Driver from '../../src/driver';

export default interface Context {
  app: ElectronApplication;
  context: BrowserContext;
  page: Page;
  driver: Driver;
  workspacePath: string;
}
