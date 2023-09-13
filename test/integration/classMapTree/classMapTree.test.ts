// @project project-base
import * as vscode from 'vscode';
import assert from 'assert';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';

import {
  waitForExtension,
  enumerateTree,
  initializeWorkspace,
  waitFor,
  ProjectBase,
  withAuthenticatedUser,
} from '../util';
import { ClassMapTreeDataProvider } from '../../../src/tree/classMapTreeDataProvider';

import comapactTreeItems from './compactTree.json';
import expectedHttpTreeItems from './expectedHttpTreeItems.json';
import expectedQueryTreeItems from './expectedQueryTreeItems.json';
import projectBaseClassMap from './projectBaseClassMap.json';

async function waitForCodeObjectsTree(): Promise<ClassMapTreeDataProvider> {
  const extension = await waitForExtension();
  const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
  assert(workspaceFolder);
  return extension.trees.codeObjects;
}

describe('class map tree items', () => {
  withAuthenticatedUser();

  let codeObjectsTree: ClassMapTreeDataProvider;

  beforeEach(async () => {
    await initializeWorkspace();

    const classMapDir = path.join(
      ProjectBase,
      'tmp',
      'appmap',
      'minitest',
      'Microposts_controller_can_get_microposts_as_JSON'
    );
    mkdirSync(classMapDir);
    writeFileSync(
      path.join(classMapDir, 'classMap.json'),
      JSON.stringify(projectBaseClassMap, null, 2)
    );

    codeObjectsTree = await waitForCodeObjectsTree();
  });

  afterEach(initializeWorkspace);

  it('has the expected tree items', async () => {
    await waitFor('Expecting tree items to match expectation', async () => {
      const actualTreeItems = await enumerateTree(codeObjectsTree);
      assert.deepStrictEqual(JSON.stringify(actualTreeItems), JSON.stringify(comapactTreeItems));
      // Previous line will throw, which is considered 'false' by waitFor
      return true;
    });
  });

  it('has the expected HTTP server request tree items with commands', async () => {
    await waitFor('Expecting tree items to match expectation', async () => {
      const actualTreeItems = await enumerateTree(codeObjectsTree, undefined, true);
      const actual = actualTreeItems.find(
        (rootTreeItem) => rootTreeItem.label === 'HTTP server requests'
      );

      assert.deepStrictEqual(JSON.stringify(actual), JSON.stringify(expectedHttpTreeItems));
      // Previous line will throw, which is considered 'false' by waitFor
      return true;
    });
  });

  it('has the expected query tree items with commands', async () => {
    await waitFor('Expecting tree items to match expectation', async () => {
      const actualTreeItems = await enumerateTree(codeObjectsTree, undefined, true);
      const actual = actualTreeItems.find((rootTreeItem) => rootTreeItem.label === 'Queries');

      assert.deepStrictEqual(JSON.stringify(actual), JSON.stringify(expectedQueryTreeItems));
      // Previous line will throw, which is considered 'false' by waitFor
      return true;
    });
  });

  it('Code tree nodes have open AppMap command type', async () => {
    await waitFor('Expecting tree items to match expectation', async () => {
      const actualTreeItems = await enumerateTree(codeObjectsTree, undefined, true);
      const actual = actualTreeItems.find((rootTreeItem) => rootTreeItem.label === 'Code');

      // All should have openCodeObjectInAppMap commands
      // actionpack->ActionController->Instrumentation->process_action
      assert.equal(actual?.children[0].command?.command, 'appmap.openCodeObjectInAppMap');
      assert.equal(
        actual?.children[0].children[0].command?.command,
        'appmap.openCodeObjectInAppMap'
      );
      assert.equal(
        actual?.children[0].children[0].children[0].command?.command,
        'appmap.openCodeObjectInAppMap'
      );
      assert.equal(
        actual?.children[0].children[0].children[0].children[0].command?.command,
        'appmap.openCodeObjectInAppMap'
      );

      return true;
    });
  });
});
