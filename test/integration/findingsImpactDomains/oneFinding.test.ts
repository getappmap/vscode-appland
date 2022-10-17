// @project project-a
import assert from 'assert';
import AppMapService from '../../../src/appMapService';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import { waitForExtension, withAuthenticatedUser } from '../util';

describe('Findings impact domains (one finding)', () => {
  withAuthenticatedUser();

  let extension: AppMapService;
  let serviceInstances: ProjectStateServiceInstance[];

  beforeEach(async () => {
    extension = await waitForExtension();
    const { projectState } = extension;
    serviceInstances = extension.workspaceServices.getServiceInstances(
      projectState
    ) as ProjectStateServiceInstance[];
  });

  it('has the expected domain counts', () => {
    const domainCounts = serviceInstances.map(
      (serviceInstance) => serviceInstance.metadata.findingsDomainCounts
    );

    assert.strictEqual(domainCounts.length, 1, 'there is one workspace in the project');

    domainCounts.forEach((domainCount) => {
      assert.strictEqual(domainCount?.performance, 1, 'there is one performance issue');
      assert.strictEqual(domainCount?.maintainability, 0, 'there are no maintainability issues');
      assert.strictEqual(domainCount?.security, 0, 'there are no security issues');
      assert.strictEqual(domainCount?.stability, 0, 'there are no stability issues');
    });
  });
});
