// @project project-several-findings
import assert from 'assert';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

import {
  withAuthenticatedUser,
  ProjectSeveralFindings,
  waitFor,
  initializeWorkspace,
  enumerateTree,
} from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';

import treeItems from './recentFindingTreeItems.json';
import { Finding } from '@appland/scanner';
import { debug } from 'console';
import { promisify } from 'util';
import { glob } from 'glob';
import { removeFindingModifiedDate } from './removeFindingModifiedDate';
import { waitForAnalysisTree } from './waitForAnalysisTree';

const findingsFileName = join(
  ProjectSeveralFindings,
  'tmp/appmap/minitest/Microposts_interface_micropost_interface/appmap-findings.json'
);

describe("Runtime analysis findings tree items, when a finding's modified date is recent", () => {
  withAuthenticatedUser();

  let prepareFindingsTask: NodeJS.Timer;
  let analysisTree: FindingsTreeDataProvider;
  let findingsFileContents: string | undefined;

  const prepareFindings = async () => {
    await Promise.all(
      (
        await promisify(glob)('**/appmap-findings.json', {
          cwd: ProjectSeveralFindings,
        })
      ).map(removeFindingModifiedDate)
    );

    if (!findingsFileContents) {
      try {
        findingsFileContents = await readFile(findingsFileName, 'utf8');
      } catch (e) {
        const err = e as Error;
        debug(`${findingsFileName} cannot be read. This is anticipated and will be retried.`);
        debug(err.toString());
        return;
      }
    }
    const findingsFile = JSON.parse(findingsFileContents) as { findings: Finding[] };
    const nPlusOneQuery = findingsFile.findings.find(
      (finding: { ruleId: string }) => finding.ruleId === 'n-plus-one-query'
    ) as Finding;
    if (nPlusOneQuery.scopeModifiedDate === undefined) {
      nPlusOneQuery.scopeModifiedDate = new Date();
      await writeFile(findingsFileName, JSON.stringify(findingsFile, null, 2));
    }
  };

  beforeEach(initializeWorkspace);
  beforeEach(async () => (analysisTree = await waitForAnalysisTree()));
  beforeEach(() => (prepareFindingsTask = setInterval(prepareFindings, 1000)));
  afterEach(() => (prepareFindingsTask ? clearTimeout(prepareFindingsTask) : undefined));
  afterEach(initializeWorkspace);

  it('has a bucket for "Last 24 hours"', async () => {
    await waitFor(`Expecting to find a date bucket for "Last 24 hours"`, async () => {
      const actualTreeItems = await enumerateTree(analysisTree);
      assert.deepStrictEqual(
        JSON.stringify(actualTreeItems, null, 2),
        JSON.stringify(treeItems, null, 2)
      );
      // Previous line will throw, which is considered 'false' by waitFor
      return true;
    });
  });
});
