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

// The Code Objects tree is built from the classMap.json written below (indexer
// output), not from analysis findings, so this suite does not need an authenticated
// user (which would only spawn the scanner and expose the test to the auth→RPC-restart
// race).
describe('class map tree items', () => {
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

      assert.equal(actual?.children.length, 8);
      // All 4 tree items in the first depth first path should have
      // openCodeObjectInAppMap commands.
      // actionpack->ActionController->Instrumentation->process_action
      let currentItem = actual?.children[0];
      while (currentItem) {
        assert.equal(currentItem.command?.command, 'appmap.openCodeObjectInAppMap');
        currentItem = currentItem.children.length > 0 ? currentItem.children[0] : undefined;
      }

      return true;
    });
  });
});
