// @project project-external-service
import * as vscode from 'vscode';
import assert from 'assert';

import {
  waitForExtension,
  enumerateTree,
  initializeWorkspace,
  waitFor,
  withAuthenticatedUser,
} from '../util';
import { ClassMapTreeDataProvider } from '../../../src/tree/classMapTreeDataProvider';

async function waitForCodeObjectsTree(): Promise<ClassMapTreeDataProvider> {
  const extension = await waitForExtension();
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
  assert(workspaceFolder);
  return extension.trees.codeObjects;
}

describe.only('class map with external service', () => {
  withAuthenticatedUser();

  let codeObjectsTree: ClassMapTreeDataProvider;

  beforeEach(async () => {
    await initializeWorkspace();

    codeObjectsTree = await waitForCodeObjectsTree();
  });

  afterEach(initializeWorkspace);

  it('Code Objects view also lists External Service Calls', async () => {
    await waitFor('Expecting tree items to match expectation', async () => {
      const actualTreeItems = await enumerateTree(codeObjectsTree, undefined, true);

      assert.equal(actualTreeItems.length, 3);

      const externalServices = actualTreeItems.find(
        (rootTreeItem) => rootTreeItem.label === 'External Services'
      );

      assert.equal(externalServices?.children.length, 1);
      assert.equal(externalServices?.children[0].label, 'api.openai.com');

      return true;
    });
  });
});
