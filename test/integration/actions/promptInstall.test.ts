import assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import { WorkspaceServices } from '../../../src/services/workspaceServices';
import promptInstall, { ButtonText } from '../../../src/actions/promptInstall';
import ExtensionState from '../../../src/configuration/extensionState';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import { ProjectA, unsafeCast } from '../util';

const stubWorkspaceServices = (installable = true, language = 'Ruby', webFramework = 'Rails') =>
  unsafeCast<WorkspaceServices>({
    getService: () => sinon.stub(),
    getServiceInstances: () =>
      unsafeCast<Array<ProjectStateServiceInstance>>([
        {
          folder: { name: path.basename(ProjectA), uri: vscode.Uri.parse(ProjectA), index: -1 },
          metadata: {
            agentInstalled: false,
            language: { name: language },
            webFramework: { name: webFramework },
          },
          installable,
        },
      ]),
  });

describe('promptInstall', () => {
  const workspaceServices = stubWorkspaceServices();

  afterEach(() => sinon.restore());

  context('in an installable project', () => {
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

      await promptInstall(workspaceServices, extensionState);

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

      await promptInstall(workspaceServices, extensionState);

      assert(executeCommand.calledWith('appmap.openInstallGuide', 'project-picker'));
    });

    it('does not re-prompt in this project if the user asks it to', async () => {
      const showInformationMessage = sinon
        .stub(vscode.window, 'showInformationMessage')
        .resolves({ title: ButtonText.DontShowAgain });
      const executeCommand = sinon.stub(vscode.commands, 'executeCommand').resolves();

      for (let i = 0; i < 5; ++i) {
        await promptInstall(workspaceServices, extensionState);
        assert(!executeCommand.called);
        assert(showInformationMessage.calledOnce);
        assert((extensionState.setHideInstallPrompt as sinon.SinonStub).calledOnce);
      }
    });
  });

  context('when the user requests to never prompt in this project', () => {
    const workspaceServices = stubWorkspaceServices();
    const extensionState = unsafeCast<ExtensionState>({ getHideInstallPrompt: () => true });

    it('does not prompt', async () => {
      const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
      await promptInstall(workspaceServices, extensionState);
      assert(!showInformationMessage.called);
    });
  });

  context('when in an uninstallable project', () => {
    const workspaceServices = stubWorkspaceServices(false);
    const extensionState = unsafeCast<ExtensionState>({ getHideInstallPrompt: () => false });

    it('does not prompt', async () => {
      const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
      await promptInstall(workspaceServices, extensionState);
      assert(!showInformationMessage.called);
    });
  });

  context('when in an installable JavaScript project', () => {
    const workspaceServices = stubWorkspaceServices(true, 'JavaScript', 'express.js');
    const extensionState = unsafeCast<ExtensionState>({ getHideInstallPrompt: () => false });

    it('does not prompt', async () => {
      const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
      await promptInstall(workspaceServices, extensionState);
      assert(!showInformationMessage.called);
    });
  });

  const languageFrameworksToPrompt = [
    { language: 'Ruby', framework: 'Rails' },
    { language: 'Java', framework: 'Spring' },
    { language: 'Python', framework: 'flask' },
    { language: 'Python', framework: 'Django' },
  ];

  languageFrameworksToPrompt.forEach(function (run) {
    context('when in an installable ' + run.language + ' ' + run.framework + ' project', () => {
      const workspaceServices = stubWorkspaceServices(true, run.language, run.framework);
      const extensionState = unsafeCast<ExtensionState>({ getHideInstallPrompt: () => false });

      it('prompts the user to install AppMap', async () => {
        const showInformationMessage = sinon.stub(vscode.window, 'showInformationMessage');
        await promptInstall(workspaceServices, extensionState);
        assert(showInformationMessage.called);
      });
    });
  });
});
