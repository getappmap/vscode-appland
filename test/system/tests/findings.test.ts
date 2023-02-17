import { strictEqual } from 'assert';
import * as path from 'path';

describe('Findings and scanning', function () {
  beforeEach(async function () {
    const { driver, project } = this;

    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await project.reset('**/*.appmap.json', 'appmap.yml', 'appmap-findings.json');
    await driver.closePanel();
    await driver.resetUsage();
    await driver.reload();
    await project.restoreFiles('appmap.yml');
    await driver.waitForFile(pidfile);
  });

  it('automatically identifies findings as AppMaps are created', async function () {
    const { driver, project } = this;

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();
    await driver.appMap.findingsTree.click();
    await driver.appMap.findingsTreeItem().waitFor();
    await project.restoreFiles('**/*.appmap.json');
    await driver.waitForFile(path.join(project.workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem(1).waitFor();
  });

  it('shows the findings overview page', async function () {
    const { driver, project } = this;
    const findingsOverviewWebview = driver.appMap['findingsOverviewWebview'];

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();
    await driver.appMap.openFindingsOverview();
    const expectedFrames = 2;
    await findingsOverviewWebview.initialize(expectedFrames);
    await findingsOverviewWebview.assertTitleRenders();
    await findingsOverviewWebview.assertNumberOfFindingsInOverview(0);
    await project.restoreFiles('**/*.appmap.json');
    await driver.waitForFile(path.join(project.workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem(1).waitFor();
    await findingsOverviewWebview.assertNumberOfFindingsInOverview(3);
  });

  it('opens the findings details page from the findings overview page', async function () {
    const { driver, project } = this;
    const findingsOverviewWebview = driver.appMap['findingsOverviewWebview'];
    const findingDetailsWebview = driver.appMap['findingDetailsWebview'];

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();
    await driver.appMap.openFindingsOverview();

    let expectedFrames = 2;
    await findingsOverviewWebview.initialize(expectedFrames);
    await findingsOverviewWebview.assertTitleRenders();
    await project.restoreFiles('**/*.appmap.json');
    await driver.waitForFile(path.join(project.workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem(1).waitFor();
    await findingsOverviewWebview.openFirstFindingDetail();

    expectedFrames = 3;
    await findingDetailsWebview.initialize(expectedFrames);

    const expectedTitle = 'N plus 1 SQL query';
    await findingDetailsWebview.assertTitleRenders(expectedTitle);
  });

  it('opens the findings details page from the runtime analysis tree view', async function () {
    const { driver, project } = this;
    const findingDetailsWebview = driver.appMap['findingDetailsWebview'];

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();

    await project.restoreFiles('**/*.appmap.json');
    await driver.waitForFile(path.join(project.workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem(1).waitFor();

    await driver.appMap.openNthFinding(2);
    const expectedFrames = 2;
    await findingDetailsWebview.initialize(expectedFrames);

    const expectedTitle = 'N plus 1 SQL query';
    await findingDetailsWebview.assertTitleRenders(expectedTitle);
  });

  it('reuses the finding details webview', async function () {
    const { driver, project } = this;
    const findingsOverviewWebview = driver.appMap['findingsOverviewWebview'];
    const findingDetailsWebview = driver.appMap['findingDetailsWebview'];

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();
    await driver.appMap.openFindingsOverview();
    let expectedFrames = 2;
    await findingsOverviewWebview.initialize(expectedFrames);

    await project.restoreFiles('**/*.appmap.json');
    await driver.waitForFile(path.join(project.workspacePath, 'tmp', '**', 'mtime')); // Wait for the indexer
    await driver.appMap.findingsTreeItem(1).waitFor();

    await findingsOverviewWebview.openFirstFindingDetail();
    expectedFrames = 3;
    await findingDetailsWebview.initialize(expectedFrames);
    await driver.appMap.openNthFinding(2);
    await findingDetailsWebview.initialize(expectedFrames);

    const numTabs = await driver.tabCount();
    strictEqual(numTabs, expectedFrames);
  });
});
