import * as vscode from 'vscode';
import AppLandClient, { Mapset } from './applandClient';
import AppMapDescriptorFile from './appmapDescriptorFile';
import AppMapDescriptorRemote from './appmapDescriptorRemote';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import registerTrees from './tree';

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  // Register our custom editor providers
  ScenarioProvider.register(context);
  DatabaseUpdater.register(context);

  const localAppMaps = AppMapDescriptorFile.allInWorkspace();
  const api = await AppLandClient.fromEnvironment();

  let applicationId = '';
  const { workspaceFolders } = vscode.workspace;
  if (workspaceFolders) {
    for (let i = 0; i < workspaceFolders.length; ++i) {
      const workspace = workspaceFolders[i];
      applicationId = await api.getApplication(workspace);
      if (applicationId) {
        break;
      }
    }
  }

  const mapsets = await api.getMapsets(applicationId);
  const mainBranch = mapsets
    .sort(
      (a: Mapset, b: Mapset) =>
        (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0)
    )
    .find((m: Mapset) => m.branch === 'master' || m.branch === 'master');
  let remoteAppMaps: Promise<AppMapDescriptorRemote[]> | null = null;
  if (mainBranch) {
    remoteAppMaps = api.getAppMaps(mainBranch.id);
  }

  registerTrees(localAppMaps, remoteAppMaps);
}
