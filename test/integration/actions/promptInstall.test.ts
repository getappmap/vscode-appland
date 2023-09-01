import assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceServices } from '../../../src/services/workspaceServices';
import promptInstall, { ButtonText } from '../../../src/actions/promptInstall';
import ExtensionState from '../../../src/configuration/extensionState';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import { ProjectA, unsafeCast } from '../util';
import Feature from '../../../src/workspace/feature';

const stubWorkspaceServices = (language: Feature, webFramework?: Feature) =>
  unsafeCast<WorkspaceServices>({
    getService: () => sinon.stub(),
    getServiceInstances: () =>
      unsafeCast<Array<ProjectStateServiceInstance>>([
        {
          folder: { name: path.basename(ProjectA), uri: vscode.Uri.parse(ProjectA), index: -1 },
          metadata: {
            agentInstalled: false,
            language,
            languages: [language],
            webFramework,
          },
        },
      ]),
  });

describe('promptInstall', () => {
  const langAndFrameworkProject = stubWorkspaceServices(
    { name: 'Ruby', score: 2, text: 'GA language' },
    { name: 'Rails', score: 2, text: 'GA framework' }
  );
  const langOnlyProject = stubWorkspaceServices({ name: 'Ruby', score: 2, text: 'GA language' });

  afterEach(() => sinon.restore());

  context('in an installable project', () => {
    const project = langAndFrameworkProject;

    let hideInstallPrompt = false;
    const extensionState = unsafeCast<ExtensionState>({
      getHideInstallPrompt: () => hideInstallPrompt,
      setHideInstallPrompt: sinon.stub().callsFake(() => {
        hideInstallPrompt = true;
      }),
    });

    afterEach(() => {
      sinon.restore();
      hideInstallPrompt = false;
    });

    it('prompts the user to install AppMap', async () => {
      const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage').resolves();

      await promptInstall(project, extensionState);

      assert(
        showInformationMessage.calledWith(
          sinon.match(/Open the setup instructions/),
          sinon.match.any
        )
      );
    });

    it('opens the instructions when the user confirms the dialog', async () => {
      sinon.stub(vscode.window, 'showInformationMessage').resolves({ title: ButtonText.Confirm });
      const executeCommand = sinon.stub(vscode.commands, 'executeCommand').resolves();

      await promptInstall(project, extensionState);

      assert(executeCommand.calledWith('appmap.openInstallGuide', 'project-picker'));
    });

    it('does not re-prompt in this project if the user asks it to', async () => {
      const showInformationMessage = sinon
        .stub(vscode.window, 'showInformationMessage')
        .resolves({ title: ButtonText.DontShowAgain });
      const executeCommand = sinon.stub(vscode.commands, 'executeCommand').resolves();

      for (let i = 0; i < 5; ++i) {
        await promptInstall(project, extensionState);
        assert(!executeCommand.called);
        assert(showInformationMessage.calledOnce);
        assert((extensionState.setHideInstallPrompt as sinon.SinonStub).calledOnce);
      }
    });
  });

  context('when the user requests to never prompt in this project', () => {
    const project = langAndFrameworkProject;
    const extensionState = unsafeCast<ExtensionState>({ getHideInstallPrompt: () => true });

    it('does not prompt', async () => {
      const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
      await promptInstall(project, extensionState);
      assert(!showInformationMessage.called);
    });
  });

  context('when in an uninstallable project', () => {
    const project = langOnlyProject;
    const extensionState = unsafeCast<ExtensionState>({ getHideInstallPrompt: () => false });

    it('does not prompt', async () => {
      const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
      await promptInstall(project, extensionState);
      assert(!showInformationMessage.called);
    });
  });
});
