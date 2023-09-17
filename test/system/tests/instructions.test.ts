import assert from 'assert';
import * as path from 'path';
import { waitFor } from '../../waitFor';
import { InstructionStep, InstructionStepStatus } from '../src/appMap';
describe('Instructions tree view', function () {
  beforeEach(async function () {
    const { driver, project } = this;
    await project.reset('**/*.appmap.json', 'appmap.yml', '**/appmap-findings.json');

    await driver.closePanel();
    await driver.resetUsage();
    await driver.reload();
  });

  it('displays a badge when AppMap installation is pending for an installable project', async function () {
    const { driver } = this;

    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    assert(await driver.appMap.pendingBadge.isVisible(), 'badge is visible');
  });

  it('accurately depicts the installation state', async function () {
    const { driver, project } = this;
    await driver.appMap.openActionPanel();
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InstallAppMapAgent,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.RecordAppMaps,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.OpenAppMaps,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InvestigateFindings,
      InstructionStepStatus.Pending
    );

    await project.simulateAppMapInstall();
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InstallAppMapAgent,
      InstructionStepStatus.Complete
    );
    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await driver.waitForFile(pidfile);

    await project.restoreFiles('**/*.appmap.json');

    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.RecordAppMaps,
      InstructionStepStatus.Complete
    );

    await project.restoreFiles('**/appmap-findings.json');
    await driver.appMap.openInstruction(InstructionStep.InvestigateFindings);
    await driver.instructionsWebview.clickButton('Open the PROBLEMS tab');
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InvestigateFindings,
      InstructionStepStatus.Complete
    );

    await driver.appMap.openAppMap();
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.OpenAppMaps,
      InstructionStepStatus.Complete
    );

    // "Delete All AppMaps" is working, but this assertion fails for other reasons.
    // FIXME: https://github.com/getappmap/vscode-appland/issues/716
    //
    // await driver.runCommand('AppMap: Delete All AppMaps');
    // await driver.appMap.assertInstructionStepStatus(
    //   InstructionStep.RecordAppMaps,
    //   InstructionStepStatus.Pending
    // );
  });

  it('opens up the expected web views', async function () {
    const { driver } = this;

    await driver.appMap.openActionPanel();

    const pages = [
      { step: InstructionStep.InstallAppMapAgent, title: 'Add AppMap to your project' },
      {
        step: InstructionStep.RecordAppMaps,
        title: 'Record AppMaps',
      },
      {
        step: InstructionStep.OpenAppMaps,
        title: 'Explore AppMaps',
      },
      {
        step: InstructionStep.InvestigateFindings,
        title: 'AppMap Runtime Analysis',
      },
    ];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      await driver.appMap.openInstruction(page.step);
      await waitFor(
        `Expected page '${page.title}' to be visible`,
        async (): Promise<boolean> => (await driver.instructionsWebview.pageTitle()) === page.title
      );
    }
  });

  it('re-uses web views', async function () {
    const { driver } = this;

    const assertTabs = async (expectedCount: number): Promise<void> => {
      const numTabs = await driver.tabCount();
      assert.strictEqual(numTabs, expectedCount, 'Wrong number of tabs');
    };

    await driver.appMap.openActionPanel();
    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);
    await assertTabs(1);

    await driver.appMap.openInstruction(InstructionStep.RecordAppMaps);
    await assertTabs(1);
  });

  it('hides the pending badge upon completing the installation steps', async function () {
    const { driver, project } = this;

    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    await project.simulateAppMapInstall();
    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await driver.waitForFile(pidfile);
    await driver.appMap.openActionPanel();
    await project.restoreFiles('**/*.appmap.json');
    await driver.appMap.openAppMap();
    await project.restoreFiles('**/appmap-findings.json');
    await driver.appMap.openInstruction(InstructionStep.InvestigateFindings);
    await driver.instructionsWebview.clickButton('Open the PROBLEMS tab');
    await driver.appMap.pendingBadge.waitFor({ state: 'hidden' });
  });

  it('can be stepped through as expected', async function () {
    const { driver, project } = this;

    await driver.appMap.openActionPanel();
    await driver.appMap.ready();

    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InstallAppMapAgent,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.RecordAppMaps,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InvestigateFindings,
      InstructionStepStatus.Pending
    );

    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);
    await driver.instructionsWebview.getPageByTitle('Add AppMap to your project').waitFor();

    await project.simulateAppMapInstall();
    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await driver.waitForFile(pidfile);

    await driver.instructionsWebview.selectProjectPickerRow('project-system');
    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('Record AppMaps').waitFor();

    await project.restoreFiles('**/*.appmap.json');
    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('Explore AppMaps').waitFor();

    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('AppMap Runtime Analysis').waitFor();

    await driver.panel.problems.waitFor({ state: 'hidden' });
    await driver.instructionsWebview.clickButton('Open the PROBLEMS tab');
    await driver.panel.problems.waitFor({ state: 'visible' });
  });

  it('always opens the project picker in an empty/undefined workspace', async function () {
    const { driver } = this;
    await driver.closeFolder();
    await driver.waitForReady();
    await driver.appMap.openActionPanel();
    await driver.appMap.ready();

    const expectProjectPicker = () =>
      waitFor(
        'Expected project picker to be visible',
        async (): Promise<boolean> =>
          (await driver.instructionsWebview.pageTitle()) === 'Add AppMap to your project'
      );

    const steps = [
      InstructionStep.InstallAppMapAgent,
      InstructionStep.RecordAppMaps,
      InstructionStep.OpenAppMaps,
      InstructionStep.InvestigateFindings,
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await driver.appMap.openInstruction(step);
      await expectProjectPicker();
    }
  });
});
