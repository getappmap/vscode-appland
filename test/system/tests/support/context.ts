import { BrowserContext, ElectronApplication, Page } from '@playwright/test';
import Driver from '../../src/driver';
import ProjectDirectory from './project';

export default interface Context {
  app: ElectronApplication;
  context: BrowserContext;
  page: Page;
  driver: Driver;
  project: ProjectDirectory;
}
