import ProjectStateService, { ProjectStateServiceInstance } from '../services/projectStateService';
import { WorkspaceServices } from '../services/workspaceServices';
import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';

export enum ButtonText {
  Confirm = 'Open instructions',
  Deny = 'Later',
  DontShowAgain = "Don't show again",
}

const promptResponses: ReadonlyArray<vscode.MessageItem> = [
  { title: ButtonText.Confirm },
  { title: ButtonText.Deny, isCloseAffordance: true },
  { title: ButtonText.DontShowAgain },
];

const meetsPromptCriteria = (project: ProjectStateServiceInstance): boolean =>
  project.installable &&
  !project.metadata.agentInstalled &&
  project.metadata.language?.name === 'Ruby' &&
  project.metadata.webFramework?.name === 'Rails';

export default async function promptInstall(
  services: WorkspaceServices,
  extensionState: ExtensionState
): Promise<void> {
  const projectService = services.getService(ProjectStateService);
  if (!projectService) return;

  const projectInstances = services.getServiceInstances(projectService);
  const silencePrompt =
    projectInstances.find(({ folder }) => extensionState.getHideInstallPrompt(folder)) !==
    undefined;
  if (silencePrompt) return;

  const numInstallable = projectInstances.filter(meetsPromptCriteria).length;
  if (!numInstallable) return;

  const numProjects = projectInstances.length;

  const msg: Array<string> = [];
  if (numProjects === 1) {
    msg.push('AppMap is ready to map and analyze this project.');
  } else {
    // Must be greater than one, otherwise we'd already have returned
    if (numProjects === numInstallable) {
      msg.push('AppMap is ready to map and analyze every project within this workspace.');
    } else {
      msg.push(`AppMap is ready to map and analyze ${numInstallable} projects in this workspace.`);
    }
  }
  msg.push('Open the setup instructions?');

  const response = await vscode.window.showInformationMessage(msg.join(' '), ...promptResponses);

  if (response?.title === ButtonText.Confirm) {
    /*
    This should execute `InstallGuideWebView.command` but requiring this file ends up importing an SVG. Our `tsc`
    compiled tests have no way of reading this file, so it'll result in a panic at runtime. For now, reference the
    command directly.
    */
    await vscode.commands.executeCommand('appmap.openInstallGuide', 'project-picker');
  } else if (response?.title === ButtonText.DontShowAgain) {
    projectInstances.forEach(({ folder }) => extensionState.setHideInstallPrompt(folder, true));
  }
}
