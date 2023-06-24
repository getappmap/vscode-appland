// @project project-several-findings
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert from 'assert';

import {
  withAuthenticatedUser,
  ProjectSeveralFindings,
  waitFor,
  initializeWorkspace,
} from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';

import treeItems from './treeItems.json';
import findingsTreeItems_noDateIndicated from './findingsTreeItems_noDateIndicated.json';
(
  treeItems
    .find((item) => item.label === 'project-several-findings')!
    .children.find((item) => item.label === 'Findings') as any
).children = findingsTreeItems_noDateIndicated;

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

  beforeEach(initializeWorkspace);
  beforeEach(async () => (analysisTree = await waitForAnalysisTree()));
  beforeEach(() => (prepareFindingsTask = setInterval(prepareFindings, 1000)));
  afterEach(() => (prepareFindingsTask ? clearTimeout(prepareFindingsTask) : undefined));
  afterEach(initializeWorkspace);

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
