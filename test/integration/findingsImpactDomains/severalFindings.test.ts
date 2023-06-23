// @project project-several-findings
import * as vscode from 'vscode';
import assert from 'assert';
import AppMapService from '../../../src/appMapService';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import { waitForExtension, withAuthenticatedUser, waitFor } from '../util';

describe('Findings impact domains (several findings)', () => {
  withAuthenticatedUser();

  let extension: AppMapService;
  let serviceInstances: ProjectStateServiceInstance[];
  let workspaceFolder: vscode.WorkspaceFolder;

  beforeEach(async () => {
    extension = await waitForExtension();
    const { projectState } = extension;
    serviceInstances = extension.workspaceServices.getServiceInstances(
      projectState
    ) as ProjectStateServiceInstance[];
    workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
    assert(workspaceFolder);
  });

  it('has the expected domain counts', async () => {
    await waitFor('Analysis was not performed', () =>
      serviceInstances.every(({ metadata }) => metadata.analysisPerformed)
    );

    const countFindings = async (domain: string, expected: number): Promise<boolean> => {
      const domainCountsAry = serviceInstances.map(
        (serviceInstance) => serviceInstance.metadata.findingsDomainCounts
      );
      if (domainCountsAry.length !== 1) return false;

      const domainCounts = domainCountsAry[0];
      assert(domainCounts);

      return domainCounts[domain] === expected;
    };

    for (const [domain, number] of Object.entries({
      performance: 2,
      maintainability: 2,
      security: 1,
      stability: 0,
    })) {
      await waitFor(`Expected ${number} ${domain} issues`, () => countFindings(domain, number));
    }
  });
});
