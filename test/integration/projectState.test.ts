// @project project-system
import assert from 'assert';
import * as vscode from 'vscode';
import { touch } from '../../src/lib/touch';
import { ProjectStateServiceInstance } from '../../src/services/projectStateService';
import { initializeWorkspace, waitForExtension, waitForIndexer } from './util';

describe('ImpactDomain', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(waitForIndexer);
  afterEach(initializeWorkspace);

  it('checks if impact domains are properly calculated ', async () => {
    const appMapService = await waitForExtension();

    const projectStateService = appMapService.projectState;
    assert(projectStateService);
    const serviceInstances = (await waitForExtension()).workspaceServices.getServiceInstances(
      projectStateService
    );
    assert.strictEqual(serviceInstances.length, 1);

    const serviceInstance = serviceInstances[0] as ProjectStateServiceInstance;
    serviceInstance.metadata().then((metadata) => {
      const domainCounts = metadata.impactDomainCounts;
      const sumOfDomainCounts =
        (domainCounts?.maintainability || 0) +
        (domainCounts?.performance || 0) +
        (domainCounts?.security || 0) +
        (domainCounts?.stability || 0);

      assert.strictEqual(sumOfDomainCounts, 1);
    });
  });
});
