import * as path from 'path';

describe('Findings and scanning', function() {
  beforeEach(async function() {
    const { driver, project } = this;

    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await project.reset('**/*.appmap.json', 'appmap.yml', 'appmap-findings.json');
    await driver.closePanel();
    await driver.resetUsage();
    await driver.reload();
    await project.restoreFiles('appmap.yml');
    await driver.waitForFile(pidfile);
  });

  it('automatically identifies findings as AppMaps are created', async function() {
    const { driver, project } = this;

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();
    await driver.appMap.findingsTree.click();
    await driver.appMap.findingsTreeItem().waitFor({ state: 'hidden' });
    await project.restoreFiles('**/*.appmap.json');
    await driver.waitForFile(path.join(project.workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem().waitFor({ state: 'visible' });
  });
});
