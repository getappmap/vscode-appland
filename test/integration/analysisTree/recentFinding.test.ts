// @project project-several-findings
import assert from 'assert';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

import { withAuthenticatedUser, ProjectSeveralFindings, waitFor } from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';

import treeItems from './recentFindingTreeItems.json';
import enumerateTree from './enumerateTree';
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

describe('Runtime analysis findings tree items', () => {
  withAuthenticatedUser();

  let prepareFindingsTask: NodeJS.Timer;
  let analysisTree: FindingsTreeDataProvider;

  beforeEach(async () => (analysisTree = await waitForAnalysisTree()));

  context("when a finding's modified date is recent", () => {
    let findingsFileContents: string | undefined;

    const prepareFindings = async () => {
      (
        await promisify(glob)('**/appmap-findings.json', {
          cwd: ProjectSeveralFindings,
        })
      ).map(removeFindingModifiedDate);

      if (!findingsFileContents) {
        try {
          findingsFileContents = await readFile(findingsFileName, 'utf8');
        } catch (e) {
          debug(`${findingsFileName} cannot be read. This is anticipated and will be retried.`);
          debug((e as any).toString());
          return;
        }
      }
      const findingsFile = JSON.parse(findingsFileContents) as any;
      const nPlusOneQuery = findingsFile.findings.find(
        (finding: any) => finding.ruleId === 'n-plus-one-query'
      ) as Finding;
      nPlusOneQuery.scopeModifiedDate = new Date();
      await writeFile(findingsFileName, JSON.stringify(findingsFile, null, 2));
    };

    beforeEach(() => (prepareFindingsTask = setInterval(prepareFindings, 1000)));
    afterEach(() => (prepareFindingsTask ? clearTimeout(prepareFindingsTask) : undefined));
    afterEach(async () => {
      if (findingsFileContents) await writeFile(findingsFileName, findingsFileContents);
    });

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
});
