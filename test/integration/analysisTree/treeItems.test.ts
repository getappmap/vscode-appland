// @project project-several-findings
import assert from 'assert';

import { withAuthenticatedUser, ProjectSeveralFindings, waitFor } from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';

import treeItems from './treeItems.json';
import enumerateTree from './enumerateTree';
import { glob } from 'glob';
import { promisify } from 'util';
import { removeFindingModifiedDate } from './removeFindingModifiedDate';
import { waitForAnalysisTree } from './waitForAnalysisTree';

describe('Runtime analysis findings tree items', () => {
  withAuthenticatedUser();

  let analysisTree: FindingsTreeDataProvider;
  let prepareFindingsTask: NodeJS.Timer;

  const prepareFindings = async () => {
    await Promise.all(
      (
        await promisify(glob)('**/appmap-findings.json', {
          cwd: ProjectSeveralFindings,
        })
      ).map(removeFindingModifiedDate)
    );
  };

  beforeEach(async () => (analysisTree = await waitForAnalysisTree()));
  beforeEach(() => (prepareFindingsTask = setInterval(prepareFindings, 1000)));
  afterEach(() => (prepareFindingsTask ? clearTimeout(prepareFindingsTask) : undefined));

  it('has the expected tree items', async () => {
    await waitFor(`Expecting tree items to match expectation`, async () => {
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
