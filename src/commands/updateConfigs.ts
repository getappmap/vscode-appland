import * as vscode from 'vscode';

import assert from 'assert';

import { RunConfigService, RunConfigServiceInstance } from '../services/runConfigService';
import { WorkspaceServices } from '../services/workspaceServices';
import chooseWorkspace from '../lib/chooseWorkspace';

const JAVA_EXTENSIONS_PACK_ID = 'vscjava.vscode-java-pack';

export default async function updateAppMapConfigs(
  context: vscode.ExtensionContext,
  runConfigService: RunConfigService,
  workspaceServices: WorkspaceServices
): Promise<void> {
  async function getRunConfigInstance(): Promise<RunConfigServiceInstance> {
    const workspace = await chooseWorkspace();
    assert(workspace);

    const runConfigServiceInstance = workspaceServices.getServiceInstance(
      runConfigService,
      workspace
    );
    assert(runConfigServiceInstance);

    return runConfigServiceInstance;
  }

  const testCommand = vscode.commands.registerCommand('appmap.updateAppMapTestConfig', async () => {
    try {
      const runConfigServiceInstance = await getRunConfigInstance();
      const updated = await runConfigServiceInstance.updateTestConfig();
      if (updated) {
        vscode.window.showInformationMessage('AppMap test configuration added.');
      } else {
        const choice = await vscode.window.showErrorMessage(
          'Failed to add AppMap test configuration. Please install the Extension Pack for Java.',
          'Install',
          'Cancel'
        );

        if (choice === 'Install') {
          vscode.commands.executeCommand('workbench.extensions.action.showExtensionsWithIds', [
            JAVA_EXTENSIONS_PACK_ID,
          ]);
        }
      }
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(`Error: ${err.message}`);
    }
  });

  context.subscriptions.push(testCommand);

  const launchCommand = vscode.commands.registerCommand(
    'appmap.updateAppMapLaunchConfig',
    async () => {
      try {
        const runConfigServiceInstance = await getRunConfigInstance();
        runConfigServiceInstance.updateLaunchConfig();
      } catch (e) {
        const err = e as Error;
        vscode.window.showErrorMessage(`Error: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(launchCommand);
}
