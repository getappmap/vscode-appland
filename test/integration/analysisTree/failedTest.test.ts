// @project project-several-findings
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { Metadata } from '@appland/models';

import { ProjectSeveralFindings } from '../util';
import { describeAnalysisTree } from './analysisTreeTest';

const appmapFileName = join(
  ProjectSeveralFindings,
  'tmp/appmap/minitest/Microposts_interface_micropost_interface.appmap.json'
);

let appmapStr: string;

// Mark the Microposts appmap as a failed test so it shows up under "Failed tests".
const markTestFailed = async () => {
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

describeAnalysisTree({
  describe: 'Runtime analysis failed test tree item',
  it: 'has the expected tree items',
  snapshot: 'failedTestTreeItems.json',
  findingsSnapshot: 'findingsTreeItems_noDateIndicated.json',
  prepare: markTestFailed,
});
