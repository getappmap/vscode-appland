// @project project-several-findings
import { describeAnalysisTree } from './analysisTreeTest';

describeAnalysisTree({
  describe: 'Runtime analysis findings tree items',
  it: 'has the expected tree items',
  snapshot: 'treeItems.json',
  findingsSnapshot: 'findingsTreeItems_noDateIndicated.json',
});
