import '../mock/vscode';

import assert from 'assert';
import { join } from 'path';
import sinon from 'sinon';
import * as vscode from 'vscode';

import { ClassMapTreeDataProvider } from '../../../src/tree/classMapTreeDataProvider';
import ClassMapIndex from '../../../src/services/classMapIndex';

import compactTreeItems from './compactTree.json';
import expectedHttpTreeItems from './expectedHttpTreeItems.json';
import expectedQueryTreeItems from './expectedQueryTreeItems.json';

// Replaces the classMapTree integration test. That booted Electron with an
// authenticated user, wrote a classMap.json into an index dir, and polled the Code
// Objects tree. ClassMapTreeDataProvider only shapes ClassMapIndex output (built by
// the already-unit-tested buildClassMap), so we feed the index the committed
// projectBaseClassMap.json directly — no Electron, indexer, auth, or watcher.

type CompactTreeItem = { label: string; command?: vscode.Command; children: CompactTreeItem[] };

// Mirrors enumerateTree from the integration util (getChildren is async here): long
// FS-path labels are shortened to their last segment.
async function enumerateTree(
  provider: ClassMapTreeDataProvider,
  parent?: vscode.TreeItem,
  withCommands = false
): Promise<CompactTreeItem[]> {
  const items = (await provider.getChildren(parent)) || [];
  const result: CompactTreeItem[] = [];
  for (const item of items) {
    let label = item.label?.toString() || 'unlabeled';
    const tokens = label.split('/');
    if (tokens.length > 1) label = tokens[tokens.length - 1];
    const compact: CompactTreeItem = {
      label,
      children: await enumerateTree(provider, item, withCommands),
    };
    // Only attach command when present so command-less nodes deep-equal the goldens
    // (which omit the key rather than storing null).
    if (withCommands && item.command) compact.command = item.command;
    result.push(compact);
  }
  return result;
}

describe('ClassMapTreeDataProvider', () => {
  let provider: ClassMapTreeDataProvider;

  beforeEach(() => {
    const folder = { uri: vscode.Uri.file('/project-base'), name: 'project-base', index: 0 };
    sinon.stub(vscode.workspace, 'workspaceFolders').value([folder]);
    // buildClassMap resolves each classMap file to a workspace folder; the folder path
    // itself doesn't affect the code-object tree, only the grouping.
    sinon.stub(vscode.workspace, 'getWorkspaceFolder').returns(folder);

    const classMapIndex = new ClassMapIndex();
    classMapIndex.addClassMapFile(vscode.Uri.file(join(__dirname, 'projectBaseClassMap.json')));
    provider = new ClassMapTreeDataProvider(classMapIndex);
  });

  afterEach(() => sinon.restore());

  it('has the expected tree items', async () => {
    assert.deepStrictEqual(await enumerateTree(provider), compactTreeItems);
  });

  it('has the expected HTTP server request tree items with commands', async () => {
    const tree = await enumerateTree(provider, undefined, true);
    const httpRequests = tree.find((item) => item.label === 'HTTP server requests');
    assert.deepStrictEqual(httpRequests, expectedHttpTreeItems);
  });

  it('has the expected query tree items with commands', async () => {
    const tree = await enumerateTree(provider, undefined, true);
    const queries = tree.find((item) => item.label === 'Queries');
    assert.deepStrictEqual(queries, expectedQueryTreeItems);
  });

  it('Code tree nodes have open AppMap command type', async () => {
    const tree = await enumerateTree(provider, undefined, true);
    const code = tree.find((item) => item.label === 'Code');
    assert.strictEqual(code?.children.length, 8);

    // Every node along the first depth-first path should carry an openCodeObjectInAppMap command.
    let current: CompactTreeItem | undefined = code?.children[0];
    while (current) {
      assert.strictEqual(current.command?.command, 'appmap.openCodeObjectInAppMap');
      current = current.children.length > 0 ? current.children[0] : undefined;
    }
  });
});
