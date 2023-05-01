import { strictEqual } from 'assert';
import * as path from 'path';

describe('Findings and scanning', function () {
  beforeEach(async function () {
    const { driver, project } = this;

    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await project.reset('**/*.appmap.json', 'appmap.yml', '**/appmap-findings.json');
    await driver.closePanel();
    await driver.resetUsage();
    await driver.reload();
    await project.restoreFiles('appmap.yml');
    await driver.waitForFile(pidfile);
  });

  it('opens a map from a findings webview', async function () {
    const { driver, project } = this;
    const findingDetailsWebview = driver.appMap['findingDetailsWebview'];
    const appMapWebview = driver.appMapWebview;

    await driver.appMap.openActionPanel();
    await driver.appMap.expandFindings();

    await project.restoreFiles('**/*.appmap.json');
    await project.restoreFiles('**/appmap-findings.json');
    await driver.appMap.findingsTreeItem(1).waitFor();

    await driver.appMap.openNthFinding(2);
    let expectedFrames = 2;
    await findingDetailsWebview.initialize(expectedFrames);

    const expectedTitle = 'N plus 1 SQL query';
    await findingDetailsWebview.assertTitleRenders(expectedTitle);
    await findingDetailsWebview.clickNthAssociatedMap(0);

    expectedFrames = 3;
    await appMapWebview.initialize(expectedFrames);

    const activeTabName = await appMapWebview.activeTab();
    strictEqual(activeTabName, 'Trace View');

    const { highlightedElement } = appMapWebview;
    const eventId = await highlightedElement.getAttribute('data-event-id');
    strictEqual(eventId, '320');

    const expectedTraceFilterValue =
      'id:320 id:340 id:360 id:380 id:400 id:420 id:440 id:460 id:480 id:500 ' +
      'id:520 id:540 id:560 id:580 id:600 id:620 id:640 id:660 id:680 id:700 ' +
      'id:720 id:740 id:760 id:780 id:800 id:820 id:840 id:860 id:880 id:900 id:300 ';

    const traceFilterValue = await appMapWebview.traceFilterValue();
    strictEqual(traceFilterValue, expectedTraceFilterValue);
  });
});
