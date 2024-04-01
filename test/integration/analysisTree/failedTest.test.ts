// @project project-several-findings
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import assert from 'assert';

import {
  withAuthenticatedUser,
  ProjectSeveralFindings,
  waitFor,
  initializeWorkspace,
  CompactTreeItem,
  enumerateTree,
} from '../util';
import { FindingsTreeDataProvider } from '../../../src/tree/findingsTreeDataProvider';

import { glob } from 'glob';
import { promisify } from 'util';
import { removeFindingModifiedDate } from './removeFindingModifiedDate';
import { waitForAnalysisTree } from './waitForAnalysisTree';
import { Metadata } from '@appland/models';
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';

import treeItems from './failedTestTreeItems.json';
import findingsTreeItems_noDateIndicated from './findingsTreeItems_noDateIndicated.json';
(
  treeItems
    .find((item) => item.label === 'project-several-findings')!
    .children.find((item) => item.label === 'Findings') as CompactTreeItem
).children = findingsTreeItems_noDateIndicated;

const appmapFileName = join(
  ProjectSeveralFindings,
  'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json'
);

describe('Runtime analysis failed test tree item', () => {
  withAuthenticatedUser();

  let analysisTree: FindingsTreeDataProvider;
  let prepareFindingsTask: NodeJS.Timeout;
  let appmapStr: string;

  const prepareFindings = async () => {
    await Promise.all(
      (
        await promisify(glob)('**/appmap-findings.json', {
          cwd: ProjectSeveralFindings,
        })
      ).map(removeFindingModifiedDate)
    );

    if (!appmapStr) appmapStr = await readFile(appmapFileName, 'utf-8');
    const appmapData = JSON.parse(appmapStr);
    const metadata = appmapData.metadata as Metadata;
    if (metadata.test_status === 'succeeded') {
      metadata.test_status = 'failed';
      metadata.test_failure = {
        message: 'Null pointer exception',
        location: 'app/models/user.rb:47',
      };
      appmapStr = JSON.stringify(appmapData, null, 2);
      await writeFile(appmapFileName, appmapStr);
    }
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
