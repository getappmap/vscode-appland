import * as vscode from 'vscode';
import { initializeWorkspace, waitFor, waitForExtension, withAuthenticatedUser } from '../util';
import assert from 'assert';
import { readyProcessWatchers } from '../../../src/lib/selectIndexProcess';
import { initializeWorkspaceServices } from '../../../src/services/workspaceServices';

describe('appmap.explain', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('opens a Chat + Search view', async () => {
    initializeWorkspaceServices();

    const chatSearchWebview = (await waitForExtension()).chatSearchWebview;

    const workspace = vscode.workspace.workspaceFolders?.[0];
    assert(workspace);

    await waitFor(
      'Explain service is not ready',
      () => readyProcessWatchers(workspace)?.length !== 0
    );

    await waitFor('Invoking appmap.explain opens a new text document', async () => {
      await vscode.commands.executeCommand('appmap.explain');

      return chatSearchWebview.currentWebview !== undefined;
    });
  });
});