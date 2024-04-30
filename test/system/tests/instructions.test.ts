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

  it('accurately depicts the installation state', async function () {
    const { driver, project } = this;
    await driver.appMap.openActionPanel();
    await driver.appMap.expandInstructions();
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InstallAppMapAgent,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.RecordAppMaps,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.NavieIntroduction,
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

    await driver.appMap.openInstruction(InstructionStep.NavieIntroduction);

    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.NavieIntroduction,
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
    await driver.appMap.expandInstructions();

    const pages = [
      { step: InstructionStep.InstallAppMapAgent, title: 'Add AppMap to your project' },
      {
        step: InstructionStep.RecordAppMaps,
        title: 'Record AppMaps',
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
    await driver.appMap.expandInstructions();
    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);
    await assertTabs(1);

    await driver.appMap.openInstruction(InstructionStep.RecordAppMaps);
    await assertTabs(1);
  });

  it('can be stepped through as expected', async function () {
    const { driver, project } = this;

    await driver.appMap.openActionPanel();
    await driver.appMap.expandInstructions();
    await driver.appMap.ready();

    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InstallAppMapAgent,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.RecordAppMaps,
      InstructionStepStatus.Pending
    );
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.NavieIntroduction,
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

    // Wait five seconds for the second tab to open.
    // The second tab is the Navie chat interface.
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for chat interface'));
      }, 5_000);
      const interval = setInterval(async () => {
        if ((await driver.tabCount()) === 2) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(undefined);
        }
      }, 100);
    });
  });

  it('always opens the project picker in an empty/undefined workspace', async function () {
    const { driver } = this;
    await driver.closeFolder();
    await driver.waitForReady();
    await driver.appMap.openActionPanel();
    await driver.appMap.ready();
    await driver.appMap.expandInstructions();

    const expectProjectPicker = () =>
      waitFor(
        'Expected project picker to be visible',
        async (): Promise<boolean> =>
          (await driver.instructionsWebview.pageTitle()) === 'Add AppMap to your project'
      );

    const steps = [
      InstructionStep.InstallAppMapAgent,
      InstructionStep.RecordAppMaps,
      InstructionStep.NavieIntroduction,
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      await driver.appMap.openInstruction(step);
      await expectProjectPicker();
    }
  });
});
