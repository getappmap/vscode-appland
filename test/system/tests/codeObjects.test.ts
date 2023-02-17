import * as path from 'path';

describe('Code object tree', function () {
  beforeEach(async function () {
    const { driver, project } = this;

    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await project.reset();
    await driver.closePanel();
    await driver.resetUsage();
    await driver.reload();
    await driver.waitForFile(pidfile);
  });

  it('opening a query code object opens an AppMap', async function () {
    const { driver } = this;

    await driver.appMap.openActionPanel();
    await driver.appMap.expandCodeObjects();
    await driver.appMap.codeObjectTreeItem(2).click();
    await driver.appMap.codeObjectTreeItem(3).click();
    await driver.appMapWebview.ready();

    // TODO: We should be testing to see if the AppMap contains an active
    // selection (i.e. the proper state is reflected), however this appears
    // to be broken at the moment.
  });
});
