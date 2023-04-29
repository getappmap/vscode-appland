import * as vscode from 'vscode';
import deleteAppMaps from '../lib/deleteAppMaps';
import AnalysisManager from '../services/analysisManager';
import ClassMapIndex from '../services/classMapIndex';
import { AppmapConfigManager, AppmapConfigManagerInstance } from '../services/appmapConfigManager';
import { workspaceServices } from '../services/workspaceServices';
import assert from 'assert';
import { join } from 'path';

export default function deleteAllAppMaps(
  context: vscode.ExtensionContext,
  classMapIndex?: ClassMapIndex
): void {
  async function deleteWorkspaceAppMaps(folder: vscode.WorkspaceFolder) {
    const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    ) as AppmapConfigManagerInstance | undefined;
    assert(appmapConfigManagerInstance);

    const appmapDir = (await appmapConfigManagerInstance.getAppmapConfig())?.appmapDir;
    if (!appmapDir) {
      console.warn(`No appmapDir for ${folder.uri}`);
      return;
    }

    deleteAppMaps(join(folder.uri.fsPath, appmapDir));
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.deleteAllAppMaps', async () => {
      await Promise.all(
        (vscode.workspace.workspaceFolders || []).map((folder) => deleteWorkspaceAppMaps(folder))
      );

      const { findingsIndex } = AnalysisManager;
      findingsIndex?.clear();
      classMapIndex?.clear();
    })
  );
}
