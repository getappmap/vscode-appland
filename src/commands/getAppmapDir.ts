import * as vscode from 'vscode';

import assert from 'assert';
import { WorkspaceServices } from '../services/workspaceServices';
import { AppmapConfigManager, AppmapConfigManagerInstance } from '../services/appmapConfigManager';

export default async function getAppmapDir(
  context: vscode.ExtensionContext,
  workspaceServices: WorkspaceServices
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.getAppmapDir',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (arg: any): Promise<string> => {
      const { cwd } = arg;
      // AFAIK this will always have cwd, but we'll check just in case
      if (!cwd) return 'tmp/appmap';

      const uri = vscode.Uri.file(cwd);
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      assert(workspaceFolder);

      const configInstance = workspaceServices.getServiceInstanceFromClass(
        AppmapConfigManager,
        workspaceFolder
      ) as AppmapConfigManagerInstance | undefined;
      assert(configInstance);

      const config = await configInstance.getAppmapConfig();
      // TODO: determine project type and pick default based on that
      if (!config) return 'tmp/appmap';

      return config.appmapDir;
    }
  );

  context.subscriptions.push(command);
}
