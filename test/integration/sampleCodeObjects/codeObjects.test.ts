// @project project-a
import assert from 'assert';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import {
  initializeWorkspace,
  waitFor,
  waitForAppMapServices,
  waitForExtension,
  withAuthenticatedUser,
} from '../util';

describe('Sample Code Objects', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(
    waitForAppMapServices.bind(
      null,
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    )
  );

  it('are created and added to project metadata', async () => {
    const appMapService = await waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    );

    await waitFor(`ClassMap not available`, async () => {
      if (!appMapService.classMap) return false;
      return (await appMapService.classMap.classMap()).length > 0;
    });

    const extension = await waitForExtension();
    const serviceInstance = extension.workspaceServices.getServiceInstances(
      extension.projectState
    )[0] as ProjectStateServiceInstance;
    const sampleCodeObjects = serviceInstance.metadata.sampleCodeObjects;

    assert.notStrictEqual(sampleCodeObjects, undefined, 'not undefined');
    assert.strictEqual(sampleCodeObjects?.httpRequests.length, 5, 'five HTTP requests');
    assert.strictEqual(sampleCodeObjects?.queries.length, 5, '5 SQL queries');
  });
});
