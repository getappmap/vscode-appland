import assert from 'assert';
import { resolve } from 'path';
import { AppmapUptodateService } from '../../../src/services/appmapUptodateService';
import { APP_SERVICES_TIMEOUT, ProjectUptodate, waitForExtension } from '../util';

export const UserFile = resolve(ProjectUptodate, 'app/models/user.rb');
export const UserPageAppMapFile = resolve(
  ProjectUptodate,
  'tmp/appmap/rspec/user_page_scenario.appmap.json'
);

export async function waitForDependsUpdate(): Promise<AppmapUptodateService> {
  const appMapService = await waitForExtension();
  assert(appMapService);
  const uptodateService = appMapService.uptodate;
  assert(uptodateService);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject('Uptodate service is not alive'), APP_SERVICES_TIMEOUT);
    uptodateService.onUpdated(() => {
      clearTimeout(timeout);
      resolve(uptodateService);
    });
  });
}
