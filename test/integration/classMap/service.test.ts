import assert from 'node:assert';
import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  ExampleAppMapIndexDir,
  initializeWorkspace,
  printCodeObject,
  ProjectA,
  waitFor,
  waitForAppMapServices,
  withAuthenticatedUser,
} from '../util';

describe('CodeObjects', () => {
  withAuthenticatedUser();

  beforeEach(async () => {
    await initializeWorkspace();
    // remove one of the appmaps to avoid races between the test code and the indexer
    await rm(
      join(ProjectA, 'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json')
    );
  });
  afterEach(initializeWorkspace);

  it.skip('index is created on startup', async () => {
    const appMapService = await waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    );
    assert.ok(appMapService.classMap);

    const classMapFile = join(ExampleAppMapIndexDir, 'classMap.json');
    await waitFor(`classMap.json not generated`, () => access(classMapFile));
    await waitFor(`ClassMap not available`, async () => {
      if (!appMapService.classMap) return false;
      return (await appMapService.classMap.classMap()).length > 0;
    });

    const classMap = await appMapService.classMap.classMap();
    const classMapDescription: string[] = [];
    for (const codeObject of classMap) printCodeObject(classMapDescription, 0, codeObject);
    assert.equal(classMapDescription.length, 86);
    assert.equal(classMapDescription[0], 'folder:root->Code');
  });
});
