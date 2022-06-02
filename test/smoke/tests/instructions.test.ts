import assert from 'assert';
import { InstructionStep, InstructionStepStatus } from '../src/appMap';
import Context from './support/context';
import ProjectDirectory from './support/project';
import clipboard from 'clipboardy';

describe('Instructions tree view', function() {
  const { driver, workspacePath } = (this.ctx as unknown) as Context;
  const project = new ProjectDirectory(workspacePath);

  beforeEach(async () => {
    await driver.closePanel();
    await project.reset();
    await project.removeAppMapFiles();
    await driver.resetUsage();
    await driver.reload();
  });

  it('displays a badge when AppMap installation is pending for an installable project', async () => {
    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    assert(await driver.appMap.pendingBadge.isVisible(), 'badge is visible');
  });

  it('does not display a badge when AppMap is not installable in the current workspace', async () => {
    // todo
  });

  it('accurately depicts the installation state', async () => {
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
      InstructionStepStatus.Complete
    );

    await project.simulateAppMapInstall();
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.InstallAppMapAgent,
      InstructionStepStatus.Complete
    );

    await project.restoreFile('*.appmap.json');
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.RecordAppMaps,
      InstructionStepStatus.Complete
    );

    await driver.appMap.openAppMap();
    await driver.appMap.assertInstructionStepStatus(
      InstructionStep.OpenAppMaps,
      InstructionStepStatus.Complete
    );
  });

  it('opens up the expected web views', async () => {
    await driver.appMap.openActionPanel();

    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);
    assert(
      (await driver.instructionsWebview.pageTitle()) == 'Install AppMap agent',
      'Opens the correct page'
    );

    await driver.appMap.openInstruction(InstructionStep.RecordAppMaps);
    assert(
      (await driver.instructionsWebview.pageTitle()) == 'Record AppMaps',
      'Opens the correct page'
    );

    await driver.appMap.openInstruction(InstructionStep.OpenAppMaps);
    assert(
      (await driver.instructionsWebview.pageTitle()) == 'Open AppMaps',
      'Opens the correct page'
    );

    await driver.appMap.openInstruction(InstructionStep.InvestigateFindings);
    assert(
      (await driver.instructionsWebview.pageTitle()) == 'Investigate findings',
      'Opens the correct page'
    );
  });

  it('re-uses web views', async () => {
    const assertTabs = async (expectedCount: number): Promise<void> => {
      const numTabs = await driver.tabCount();
      assert(numTabs === expectedCount, `Expected ${expectedCount} tabs, got ${numTabs}`);
    };

    const baseTabCount = await driver.tabCount();
    const expectedTabCount = baseTabCount + 1;

    await driver.appMap.openActionPanel();
    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);
    await assertTabs(expectedTabCount);

    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);
    await assertTabs(expectedTabCount);
  });

  it('hides the pending badge upon completing the installation steps', async () => {
    await driver.appMap.pendingBadge.waitFor({ state: 'visible' });
    await project.simulateAppMapInstall();
    await project.restoreFile('*.appmap.json');
    await driver.appMap.openAppMap();
    await driver.appMap.pendingBadge.waitFor({ state: 'hidden' });
  });

  it('can be stepped through as expected', async () => {
    await driver.appMap.openActionPanel();
    await driver.appMap.ready();

    await driver.appMap.pendingBadge.isVisible();
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
      InstructionStepStatus.Complete
    );

    await driver.appMap.openInstruction(InstructionStep.InstallAppMapAgent);

    await driver.instructionsWebview.copyClipboardText();
    {
      const expected = `npx @appland/appmap install ${workspacePath}`;
      const actual = clipboard.readSync();
      assert(
        expected === actual,
        `Clipboard text should be correct\nexpected: ${expected}\nactual: ${actual}`
      );
    }

    await project.simulateAppMapInstall();

    await driver.instructionsWebview.clickButton('Next');
    await driver.instructionsWebview.copyClipboardText();
    {
      const expected = 'npx @appland/appmap record test';
      const actual = clipboard.readSync();
      assert(
        expected === actual,
        `Clipboard text should be correct\nexpected: ${expected}\nactual: ${actual}`
      );
    }

    await project.restoreFile('*.appmap.json');
    await driver.instructionsWebview.clickButton('Next');

    await driver.appMap.openAppMap();
    await driver.instructionsWebview.clickButton('Next');

    await driver.panel.problems.waitFor({ state: 'hidden' });

    await driver.instructionsWebview.clickButton('View problems');

    await driver.panel.problems.waitFor({ state: 'visible' });
  });
});
