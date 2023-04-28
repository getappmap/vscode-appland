// @project project-several-findings
import * as vscode from 'vscode';
import assert from 'assert';
import AppMapService from '../../../src/appMapService';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import { waitForExtension, withAuthenticatedUser, waitFor } from '../util';
import { cp, rm } from 'fs/promises';
import { join } from 'path';

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
    // Findings must be in appmap_dir to be recognized.
    await cp(
      join(workspaceFolder.uri.fsPath, 'appmap-findings.json'),
      join(workspaceFolder.uri.fsPath, 'tmp/appmap', 'appmap-findings.json')
    );
  });

  afterEach(async () => {
    await rm(join(workspaceFolder.uri.fsPath, 'tmp/appmap', 'appmap-findings.json'), {
      force: true,
    });
  });

  it('has the expected domain counts', async () => {
    await waitFor('Analysis was not performed', () =>
      serviceInstances.every(({ metadata }) => metadata.analysisPerformed)
    );

    const domainCounts = serviceInstances.map(
      (serviceInstance) => serviceInstance.metadata.findingsDomainCounts
    );

    assert.strictEqual(domainCounts.length, 1, 'there is one workspace in the project');

    domainCounts.forEach((domainCount) => {
      assert.strictEqual(domainCount?.performance, 1, 'there is one performance issue');
      assert.strictEqual(domainCount?.maintainability, 0, 'there are no maintainability issues');
      assert.strictEqual(domainCount?.security, 1, 'there is one security issue');
      assert.strictEqual(domainCount?.stability, 0, 'there are no stability issues');
    });
  });
});
