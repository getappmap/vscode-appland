import assert from 'assert';
import * as path from 'path';
import { waitFor } from '../../waitFor';
import { InstructionStep, InstructionStepStatus } from '../src/appMap';
import Driver from '../src/driver';

async function waitForTabs(expectedTabs: number, driver: Driver): Promise<void> {
  let timeout: NodeJS.Timeout;
  let interval: NodeJS.Timeout;

  return new Promise<void>((resolve, reject) => {
    timeout = setTimeout(async () => {
      clearTimeout(timeout);
      clearInterval(interval);
      reject(`Expected ${expectedTabs} tabs to be open, actually were ${await driver.tabCount()}`);
    }, 5_000);

    interval = setInterval(async () => {
      if ((await driver.tabCount()) === expectedTabs) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve();
      }
    }, 100);
  });
}

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

    // this should already be complete because Navie opens automatically
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

    await driver.appMap.openActionPanel();
    await driver.appMap.expandInstructions();
    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);

    // Navie and the Install Guide should be open
    await waitForTabs(2, driver);

    await driver.appMap.openInstruction(InstructionStep.RecordAppMaps);
    await waitForTabs(2, driver);
  });

  it('hides the pending badge upon completing the installation steps', async function () {
    const { driver, project } = this;

    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    await project.simulateAppMapInstall();
    const pidfile = path.join(project.workspacePath, '**', 'index.pid');
    await driver.waitForFile(pidfile);
    await driver.appMap.openActionPanel();
    await driver.appMap.expandInstructions();
    await project.restoreFiles('**/*.appmap.json');
    // we don't need to open Navie because it opens automatically
    await driver.appMap.pendingBadge.waitFor({ state: 'hidden' });
  });

  it('can be stepped through as expected', async function () {
    const { driver, project } = this;

    await driver.appMap.openActionPanel();
    await driver.appMap.expandInstructions();
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
      InstructionStep.NavieIntroduction,
      InstructionStepStatus.Pending
    );

    // open instructions
    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);

    // Wait for Navie to open automatically
    await waitForTabs(2, driver);

    // ensure that the instructions are active
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
    // there should be three tabs now: two Navie tabs and the instructions
    await waitForTabs(3, driver);
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
