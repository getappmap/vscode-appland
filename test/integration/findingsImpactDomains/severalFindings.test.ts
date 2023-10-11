// @project project-several-findings
import * as vscode from 'vscode';
import assert from 'assert';
import AppMapService from '../../../src/appMapService';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import {
  waitForExtension,
  withAuthenticatedUser,
  waitFor,
  repeatUntil,
  ProjectSeveralFindings,
} from '../util';
import AppMapEditorProvider from '../../../src/editor/appmapEditorProvider';
import { join } from 'path';

describe('Findings impact domains (several findings)', () => {
  withAuthenticatedUser();

  let extension: AppMapService;
  let serviceInstances: ProjectStateServiceInstance[];
  let workspaceFolder: vscode.WorkspaceFolder;
  let editorProvider: AppMapEditorProvider;

  beforeEach(async () => {
    extension = await waitForExtension();
    const { projectState } = extension;
    editorProvider = extension.editorProvider;
    serviceInstances = extension.workspaceServices.getServiceInstances(projectState);
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

  it('should determine if runtime analysis be completed', async () => {
    // explore appmaps
    await vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.file(
        join(
          ProjectSeveralFindings,
          'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json'
        )
      )
    );
    await waitFor('AppMap diagram should be opened', () => editorProvider.openDocuments.length > 0);

    await repeatUntil(
      async () =>
        await vscode.commands.executeCommand('appmap.openInstallGuide', 'investigate-findings'),
      'analysis page has not been opened',
      () => !!extension.extensionState.getWorkspaceOpenedAnalysis(workspaceFolder)
    );
    assert.strictEqual(
      extension.extensionState.getWorkspaceOpenedAnalysis(workspaceFolder),
      true,
      'Analysis page has been opened'
    );
    assert.strictEqual(
      extension.extensionState.getFindingsInvestigated(workspaceFolder),
      true,
      'Appmaps have been analyzed'
    );
  });
});
