import '../mock/vscode';

import assert from 'assert';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as fse from 'fs-extra';
import { glob } from 'glob';
import sinon from 'sinon';
import * as vscode from 'vscode';
import * as tmp from 'tmp';

import FindingsIndex from '../../../src/services/findingsIndex';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';
import MockAppMapCollection from '../../mocks/mockAppMapCollection';
import MockAppMapLoader from '../../mocks/mockAppMapLoader';
import MockExtensionContext from '../../mocks/mockExtensionContext';

// This suite replaces the former analysisTree integration tests
// (treeItems / failedTest / recentFinding). Those booted a full Electron VS Code
// and a real scanner subprocess, then polled a file-watcher-populated tree with no
// deterministic completion signal — the single flakiest family in the suite.
//
// FindingsTreeDataProvider.getChildren is pure tree-shaping over findingsIndex.findings(),
// appmaps.allAppMaps() and workspace.workspaceFolders, and FindingsIndex.addFindingsFile only
// reads findings JSON off disk. So we can build a fully-populated index from the committed
// project-several-findings fixture and assert against the very same golden files the
// integration tests used — deterministically, with no subprocess, auth, or watcher.

// Golden snapshots, moved here from the (now-removed) integration analysisTree harness.
const GOLDEN_DIR = __dirname;
const FIXTURE = join(__dirname, '../../../test/fixtures/workspaces/project-several-findings');

type CompactTreeItem = { label: string; command?: vscode.Command; children: CompactTreeItem[] };

// Mirrors enumerateTree from the integration util: long FS-path labels are shortened
// to their last segment so we don't assert on absolute paths.
function enumerateTree(
  provider: FindingsTreeDataProvider,
  parent?: vscode.TreeItem,
  withCommands = false
): CompactTreeItem[] {
  const items = provider.getChildren(parent) || [];
  return items.map((item) => {
    let label = item.label?.toString() || 'unlabeled';
    const tokens = label.split('/');
    if (tokens.length > 1) label = tokens[tokens.length - 1];
    const compact: CompactTreeItem = {
      label,
      children: enumerateTree(provider, item, withCommands),
    };
    if (withCommands) compact.command = item.command;
    return compact;
  });
}

function golden(file: string): string {
  return join(GOLDEN_DIR, file);
}

function findingsNode(tree: CompactTreeItem[]): CompactTreeItem {
  const project = tree.find((item) => item.label === 'project-several-findings');
  assert(project, 'expected a "project-several-findings" node');
  const findings = project.children.find((item) => item.label === 'Findings');
  assert(findings, 'expected a "Findings" node under the project');
  return findings;
}

// Splice the separately-stored Findings subtree into the main snapshot, matching how the
// integration harness stored these goldens.
function readSnapshot(snapshot: string, findingsSnapshot?: string): CompactTreeItem[] {
  const tree = JSON.parse(readFileSync(golden(snapshot), 'utf8')) as CompactTreeItem[];
  if (findingsSnapshot) {
    findingsNode(tree).children = JSON.parse(readFileSync(golden(findingsSnapshot), 'utf8'));
  }
  return tree;
}

interface Scenario {
  snapshot: string;
  findingsSnapshot?: string;
  // Mutate the copied fixture (findings and/or appmap files) before the index is built.
  prepare?: (workspaceDir: string) => void;
}

async function buildProvider(scenario: Scenario): Promise<FindingsTreeDataProvider> {
  // Work on a throwaway copy so per-scenario mutations never touch the committed fixture.
  const workspaceDir = tmp.dirSync({ unsafeCleanup: true }).name;
  fse.copySync(FIXTURE, workspaceDir);

  scenario.prepare?.(workspaceDir);

  const folder: vscode.WorkspaceFolder = {
    uri: vscode.Uri.file(workspaceDir),
    name: 'project-several-findings',
    index: 0,
  };
  sinon.stub(vscode.workspace, 'workspaceFolders').value([folder]);
  sinon
    .stub(vscode.workspace, 'getWorkspaceFolder')
    .callsFake((uri) => (uri?.fsPath.startsWith(workspaceDir) ? folder : undefined));

  const findingsIndex = new FindingsIndex();
  for (const file of glob.sync('**/appmap-findings.json', { cwd: workspaceDir, absolute: true })) {
    await findingsIndex.addFindingsFile(vscode.Uri.file(file));
  }

  const loaders = glob
    .sync('**/*.appmap.json', { cwd: workspaceDir, absolute: true })
    .map((file) => {
      const { metadata } = JSON.parse(readFileSync(file, 'utf8'));
      return new MockAppMapLoader({ resourceUri: vscode.Uri.file(file), metadata });
    });

  class Collection extends MockAppMapCollection {
    allAppMaps() {
      return loaders;
    }
    appMaps() {
      return loaders;
    }
  }

  const provider = new FindingsTreeDataProvider(new MockExtensionContext(), new Collection());
  provider.setFindingsIndex(findingsIndex);
  return provider;
}

describe('FindingsTreeDataProvider', () => {
  afterEach(() => sinon.restore());

  it('renders the findings tree (no date indicated)', async () => {
    const provider = await buildProvider({
      snapshot: 'treeItems.json',
      findingsSnapshot: 'findingsTreeItems_noDateIndicated.json',
    });
    assert.deepStrictEqual(
      enumerateTree(provider),
      readSnapshot('treeItems.json', 'findingsTreeItems_noDateIndicated.json')
    );
  });

  it('groups a failed test under "Failed tests"', async () => {
    const provider = await buildProvider({
      snapshot: 'failedTestTreeItems.json',
      findingsSnapshot: 'findingsTreeItems_noDateIndicated.json',
      prepare: (workspaceDir) => {
        const appmapFile = join(
          workspaceDir,
          'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json'
        );
        const appmap = JSON.parse(readFileSync(appmapFile, 'utf8'));
        appmap.metadata.test_status = 'failed';
        appmap.metadata.test_failure = {
          message: 'Null pointer exception',
          location: 'app/models/user.rb:47',
        };
        writeFileSync(appmapFile, JSON.stringify(appmap, null, 2));
      },
    });
    assert.deepStrictEqual(
      enumerateTree(provider),
      readSnapshot('failedTestTreeItems.json', 'findingsTreeItems_noDateIndicated.json')
    );
  });

  it('buckets a recently-modified finding under "Last 24 hours"', async () => {
    const provider = await buildProvider({
      snapshot: 'recentFindingTreeItems.json',
      prepare: (workspaceDir) => {
        const findingsFile = join(
          workspaceDir,
          'tmp/appmap/minitest/Microposts_interface_micropost_interface/appmap-findings.json'
        );
        const data = JSON.parse(readFileSync(findingsFile, 'utf8'));
        const nPlusOne = data.findings.find(
          (f: { ruleId: string }) => f.ruleId === 'n-plus-one-query'
        );
        assert(nPlusOne, 'expected an n-plus-one-query finding in the fixture');
        nPlusOne.scopeModifiedDate = new Date().toISOString();
        writeFileSync(findingsFile, JSON.stringify(data, null, 2));
      },
    });
    assert.deepStrictEqual(enumerateTree(provider), readSnapshot('recentFindingTreeItems.json'));
  });
});
