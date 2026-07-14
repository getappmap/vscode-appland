// @project project-several-findings
import { join } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { debug } from 'console';
import { Finding } from '@appland/scanner';

import { ProjectSeveralFindings } from '../util';
import { describeAnalysisTree } from './analysisTreeTest';

const findingsFileName = join(
  ProjectSeveralFindings,
  'tmp/appmap/minitest/Microposts_interface_micropost_interface/appmap-findings.json'
);

let findingsFileContents: string | undefined;

// Give the n+1 query finding a recent modified date so it lands in the
// "Last 24 hours" date bucket.
const markFindingRecent = async () => {
  if (!findingsFileContents) {
    try {
      findingsFileContents = await readFile(findingsFileName, 'utf8');
    } catch (e) {
      debug(`${findingsFileName} cannot be read. This is anticipated and will be retried.`);
      debug((e as Error).toString());
      return;
    }
  }
  const findingsFile = JSON.parse(findingsFileContents) as { findings: Finding[] };
  const nPlusOneQuery = findingsFile.findings.find(
    (finding) => finding.ruleId === 'n-plus-one-query'
  ) as Finding;
  if (nPlusOneQuery.scopeModifiedDate === undefined) {
    nPlusOneQuery.scopeModifiedDate = new Date();
    await writeFile(findingsFileName, JSON.stringify(findingsFile, null, 2));
  }
};

describeAnalysisTree({
  describe: "Runtime analysis findings tree items, when a finding's modified date is recent",
  it: 'has a bucket for "Last 24 hours"',
  snapshot: 'recentFindingTreeItems.json',
  prepare: markFindingRecent,
});
