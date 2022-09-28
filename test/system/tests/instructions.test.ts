import assert from 'assert';
import * as path from 'path';
import { waitFor } from '../../waitFor';
import { InstructionStep, InstructionStepStatus } from '../src/appMap';
import Driver from '../src/driver';
import ProjectDirectory from './support/project';

type DriverContext = { driver: Driver; project: ProjectDirectory };

describe('Instructions tree view', function() {
  beforeEach(async function() {
    const { driver, project }: DriverContext = this as any;
    await project.reset('**/*.appmap.json', 'appmap.yml', 'appmap-findings.json');

    await driver.closePanel();
    await driver.resetUsage();
    await driver.reload();
  });

  it('displays a badge when AppMap installation is pending for an installable project', async function() {
    const { driver }: DriverContext = this as any;

    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    assert(await driver.appMap.pendingBadge.isVisible(), 'badge is visible');
  });

  it('accurately depicts the installation state', async function() {
    const { driver, project }: DriverContext = this as any;
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
      InstructionStep.GenerateOpenApi,
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
    const pidfile = path.join(project.appMapDirectoryPath, 'index.pid');
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

    await driver.runCommand('AppMap: Generate OpenAPI definitions');
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.GenerateOpenApi,
      InstructionStepStatus.Complete
    );
  });

  it('opens up the expected web views', async function() {
    const { driver }: DriverContext = this as any;

    await driver.appMap.openActionPanel();

    const pages = [
      { step: InstructionStep.InstallAppMapAgent, title: 'Install AppMap agent' },
      {
        step: InstructionStep.RecordAppMaps,
        title: 'Record AppMaps',
      },
      {
        step: InstructionStep.OpenAppMaps,
        title: 'Explore AppMaps',
      },
      {
        step: InstructionStep.GenerateOpenApi,
        title: 'Generate OpenAPI',
      },
      {
        step: InstructionStep.InvestigateFindings,
        title: 'AppMap Runtime Analysis',
      },
    ];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      await driver.appMap.openInstruction(page.step);
      waitFor(
        `Expected page '${page.title}' to be visible`,
        async (): Promise<boolean> => (await driver.instructionsWebview.pageTitle()) === page.title
      );
    }
  });

  it('re-uses web views', async function() {
    const { driver }: DriverContext = this as any;

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

  it('hides the pending badge upon completing the installation steps', async function() {
    const { driver, project }: DriverContext = this as any;

    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    await project.simulateAppMapInstall();
    const pidfile = path.join(project.appMapDirectoryPath, 'index.pid');
    await driver.waitForFile(pidfile);
    await driver.appMap.openActionPanel();
    await project.restoreFiles('**/*.appmap.json');
    await driver.appMap.openAppMap();
    await project.restoreFiles('**/appmap-findings.json');
    await driver.appMap.openInstruction(InstructionStep.InvestigateFindings);
    await driver.instructionsWebview.clickButton('Open the PROBLEMS tab');
    await driver.runCommand('AppMap: Generate OpenAPI definitions');
    await driver.appMap.pendingBadge.waitFor({ state: 'hidden' });
  });

  it('can be stepped through as expected', async function() {
    const { driver, project }: DriverContext = this as any;

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
    await driver.instructionsWebview.getPageByTitle('Install AppMap agent').waitFor();

    // TODO: This has stopped working. Clipboard text is returned as '>', despite the button
    // actually working.
    //
    // await driver.instructionsWebview.copyClipboardText();
    // {
    //   const expected = `npx @appland/appmap install ${workspacePath}`;
    //   const actual = clipboard.readSync();
    //   assert(
    //     expected === actual,
    //     `Clipboard text should be correct\nexpected: ${expected}\nactual: ${actual}`
    //   );
    // }

    await project.simulateAppMapInstall();
    const pidfile = path.join(project.appMapDirectoryPath, 'index.pid');
    await driver.waitForFile(pidfile);

    await driver.instructionsWebview.selectProjectPickerRow('project-system');
    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('Record AppMaps').waitFor();

    // TODO: This has stopped working. Clipboard text is returned as '>', despite the button
    // actually working.
    //
    // await driver.instructionsWebview.copyClipboardText();
    // {
    //   const expected = 'npx @appland/appmap record test';
    //   const actual = clipboard.readSync();
    //   assert(
    //     expected === actual,
    //     `Clipboard text should be correct\nexpected: ${expected}\nactual: ${actual}`
    //   );
    // }

    await project.restoreFiles('**/*.appmap.json');
    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('Explore AppMaps').waitFor();

    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('Generate OpenAPI').waitFor();

    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.getPageByTitle('AppMap Runtime Analysis').waitFor();

    await driver.panel.problems.waitFor({ state: 'hidden' });
    await driver.instructionsWebview.clickButton('Open the PROBLEMS tab');
    await driver.panel.problems.waitFor({ state: 'visible' });
  });
});
