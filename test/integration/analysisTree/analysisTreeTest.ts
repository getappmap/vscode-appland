/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert from 'assert';
import { join, sep } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import { glob } from 'glob';

import {
  withAuthenticatedUser,
  ProjectSeveralFindings,
  waitFor,
  initializeWorkspace,
  CompactTreeItem,
  enumerateTree,
} from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';
import { removeFindingModifiedDate } from './removeFindingModifiedDate';
import { waitForAnalysisTree } from './waitForAnalysisTree';

// Run the suite with UPDATE_SNAPSHOTS=1 to rewrite the golden files from the
// live tree instead of asserting against them, e.g.
//
//   UPDATE_SNAPSHOTS=1 TEST_FILE=./analysisTree/treeItems.test.ts yarn test:integration
//
// Review the resulting diff before committing.
const UPDATE_SNAPSHOTS = process.env.UPDATE_SNAPSHOTS === '1';

export interface AnalysisTreeTestOptions {
  /** describe(...) block title */
  describe: string;
  /** it(...) title */
  it: string;
  /** Golden file for the whole tree, relative to this directory. */
  snapshot: string;
  /**
   * Optional golden file for the "Findings" subtree, spliced under
   * project → Findings. Lets tests that share the same findings tree reuse a
   * single golden instead of duplicating it. On update it is written
   * separately and blanked out in the main snapshot.
   */
  findingsSnapshot?: string;
  /**
   * Optional per-tick mutation, applied after the modified dates are stripped
   * from every findings file. Use it to shape the fixture for this test (e.g.
   * mark a test as failed, or make a finding recent).
   */
  prepare?: () => Promise<void>;
}

// At runtime __dirname is the compiled location (…/out/test/integration/analysisTree),
// but the golden files live in the TypeScript source tree — and since we read them via
// fs (not `import`), tsc never copies fresh ones into out/. Resolve back to source so
// snapshots are read from and written to the files under version control. Under ts-node
// there is no `out/` segment and this is a no-op. The matched segment is specific enough
// (`/out/test/integration/`) that it can't collide with an ancestor directory name.
const SOURCE_DIR = __dirname.replace(
  `${sep}out${sep}test${sep}integration${sep}`,
  `${sep}test${sep}integration${sep}`
);

function snapshotPath(file: string): string {
  return join(SOURCE_DIR, file);
}

function findingsNode(tree: CompactTreeItem[]): CompactTreeItem {
  const project = tree.find((item) => item.label === 'project-several-findings');
  assert(project, 'expected a "project-several-findings" node in the tree');
  const findings = project.children.find((item) => item.label === 'Findings');
  assert(findings, 'expected a "Findings" node under the project');
  return findings;
}

async function readSnapshot(options: AnalysisTreeTestOptions): Promise<CompactTreeItem[]> {
  const tree = JSON.parse(await readFile(snapshotPath(options.snapshot), 'utf8'));
  if (options.findingsSnapshot) {
    findingsNode(tree).children = JSON.parse(
      await readFile(snapshotPath(options.findingsSnapshot), 'utf8')
    );
  }
  return tree;
}

async function writeSnapshot(
  options: AnalysisTreeTestOptions,
  actual: CompactTreeItem[]
): Promise<void> {
  if (options.findingsSnapshot) {
    const findings = findingsNode(actual);
    // enumerateTree always sets children to an array, but guard anyway so a future
    // change can't silently write the string "undefined" to the golden.
    await writeFile(
      snapshotPath(options.findingsSnapshot),
      JSON.stringify(findings.children ?? [], null, 2) + '\n'
    );
    // Keep the main snapshot free of the (separately stored) findings subtree.
    findings.children = [];
  }
  await writeFile(snapshotPath(options.snapshot), JSON.stringify(actual, null, 2) + '\n');
}

// How long the tree must stop changing before we trust it. It has to exceed the
// prepareFindings interval (1s) plus re-index latency, otherwise we snapshot the
// freshly-loaded tree before this test's `prepare` mutation (a failed test, a
// recent finding, …) has had a chance to land.
const SETTLE_MS = 5000;

// The tree is populated asynchronously by a background scan, and prepareFindings
// keeps rewriting the findings files, so there is no single "done" signal. When
// asserting we poll until the tree matches the golden; when regenerating we
// can't use the golden as the settle condition, so instead we wait until the
// enumerated tree has held steady (and non-empty) for SETTLE_MS. Elapsed time,
// not a read count, is what matters: the base tree can go quiet for several fast
// reads before the 1s-interval mutation ever fires.
async function waitForStableTree(
  analysisTree: FindingsTreeDataProvider
): Promise<CompactTreeItem[]> {
  let latest: CompactTreeItem[] = [];
  let latestSerialized = '';
  // performance.now() is monotonic; a wall-clock jump must not reset or short-circuit
  // the settle window.
  let stableSince = performance.now();
  await waitFor(
    'analysis tree to settle before snapshotting',
    async () => {
      const tree = await enumerateTree(analysisTree);
      const serialized = JSON.stringify(tree);
      if (serialized !== latestSerialized) {
        latest = tree;
        latestSerialized = serialized;
        stableSince = performance.now();
      }
      const project = tree.find((item) => item.label === 'project-several-findings');
      const loaded = !!project?.children?.some((item) => item.label === 'Findings');
      return loaded && performance.now() - stableSince >= SETTLE_MS;
    },
    60000
  );
  return latest;
}

export function describeAnalysisTree(options: AnalysisTreeTestOptions): void {
  describe(options.describe, () => {
    withAuthenticatedUser();

    let analysisTree: FindingsTreeDataProvider;
    let prepareFindingsTask: NodeJS.Timeout;

    const prepareFindings = async () => {
      await Promise.all(
        (
          await promisify(glob)('**/appmap-findings.json', { cwd: ProjectSeveralFindings })
        ).map(removeFindingModifiedDate)
      );
      if (options.prepare) await options.prepare();
    };

    beforeEach(initializeWorkspace);
    beforeEach(async () => (analysisTree = await waitForAnalysisTree()));
    beforeEach(() => (prepareFindingsTask = setInterval(prepareFindings, 1000)));
    afterEach(() => (prepareFindingsTask ? clearInterval(prepareFindingsTask) : undefined));
    afterEach(initializeWorkspace);

    it(options.it, async () => {
      if (UPDATE_SNAPSHOTS) {
        await writeSnapshot(options, await waitForStableTree(analysisTree));
        return;
      }

      const expected = await readSnapshot(options);
      await waitFor(`Expecting tree items to match ${options.snapshot}`, async () => {
        const actualTreeItems = await enumerateTree(analysisTree);
        assert.deepStrictEqual(
          JSON.stringify(actualTreeItems, null, 2),
          JSON.stringify(expected, null, 2)
        );
        // Previous line will throw, which is considered 'false' by waitFor
        return true;
      });
    });
  });
}
