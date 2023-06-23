// @project project-no-findings
import assert from 'assert';
import AppMapService from '../../../src/appMapService';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import { waitForExtension, withAuthenticatedUser, waitFor } from '../util';

describe('Findings impact domains (no findings)', () => {
  withAuthenticatedUser();

  let extension: AppMapService;
  let serviceInstances: ProjectStateServiceInstance[];

  beforeEach(async () => {
    extension = await waitForExtension();
    const { projectState } = extension;
    serviceInstances = extension.workspaceServices.getServiceInstances(projectState);
    await waitFor('Analysis was not performed', () =>
      serviceInstances.every(({ metadata }) => metadata.analysisPerformed)
    );
  });

  it('has the expected domain counts', () => {
    const domainCounts = serviceInstances.map(
      (serviceInstance) => serviceInstance.metadata.findingsDomainCounts
    );

    assert.strictEqual(domainCounts.length, 1, 'there is one workspace in the project');

    domainCounts.forEach((domainCount) => {
      assert.strictEqual(domainCount?.performance, 0, 'there are no performance issue');
      assert.strictEqual(domainCount?.maintainability, 0, 'there are no maintainability issues');
      assert.strictEqual(domainCount?.security, 0, 'there are no security issues');
      assert.strictEqual(domainCount?.stability, 0, 'there are no stability issues');
    });
  });
});
