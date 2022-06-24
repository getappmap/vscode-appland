import Context from './support/context';
import ProjectDirectory from './support/project';
import * as path from 'path';

describe('Findings and scanning', function() {
  const { driver, workspacePath } = (this.ctx as unknown) as Context;
  const project = new ProjectDirectory(workspacePath);

  beforeEach(async () => {
    await driver.closePanel();
    await project.reset();
    await project.removeAppMapFiles();
    await driver.resetUsage();
    await driver.reload();
  });

  after(async () => {
    await project.reset();
  });

  it('automatically identifies findings as AppMaps are created', async () => {
    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();
    await driver.appMap.findingsTree.click();
    await driver.appMap.findingsTreeItem().waitFor({ state: 'hidden' });
    await project.restoreFile('**/*.appmap.json');
    await driver.waitForFile(path.join(workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem().waitFor({ state: 'visible' });
  });
});
