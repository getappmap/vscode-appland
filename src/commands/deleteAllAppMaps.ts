import * as vscode from 'vscode';
import deleteAppMaps from '../lib/deleteAppMaps';
import AnalysisManager from '../services/analysisManager';
import ClassMapIndex from '../services/classMapIndex';
import { AppmapConfigManager } from '../services/appmapConfigManager';
import { workspaceServices } from '../services/workspaceServices';
import assert from 'assert';
import { join } from 'path';
import AppMapCollection from '../services/appmapCollection';

export default function deleteAllAppMaps(
  context: vscode.ExtensionContext,
  appMapCollection: AppMapCollection,
  classMapIndex?: ClassMapIndex
): void {
  async function deleteWorkspaceAppMaps(folder: vscode.WorkspaceFolder) {
    const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
      AppmapConfigManager,
      folder
    );
    assert(appmapConfigManagerInstance);

    const appmapDir = (await appmapConfigManagerInstance.getAppmapConfig())?.appmapDir;
    if (!appmapDir) {
      console.warn(`No appmapDir for ${folder.uri}`);
      return;
    }

    await deleteAppMaps(join(folder.uri.fsPath, appmapDir), appMapCollection);
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
