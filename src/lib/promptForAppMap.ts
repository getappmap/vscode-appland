import assert from 'assert';
import { basename } from 'path';
import * as vscode from 'vscode';
import AppMapLoader from '../services/appmapLoader';
import { getWorkspaceFolderFromPath, timeAgo } from '../util';
import { AppmapConfigManager } from '../services/appmapConfigManager';
import { workspaceServices } from '../services/workspaceServices';

export async function promptForAppMap(
  appmaps: AppMapLoader[],
  exclude: vscode.Uri[] = []
): Promise<vscode.Uri | undefined> {
  const now = Date.now();
  const uriMap = new Map<string, vscode.Uri>();
  const items = (
    await Promise.all(
      appmaps
        .filter((appmap) => appmap.descriptor.metadata?.name)
        .filter((appmap) => !exclude.includes(appmap.descriptor.resourceUri))
        .map(async (appmap) => {
          assert(appmap.descriptor.metadata?.name);
          let path = appmap.descriptor.resourceUri.fsPath;
          const projectFolder = getWorkspaceFolderFromPath(path);
          const label = [appmap.descriptor.metadata?.name];
          if (projectFolder) {
            path = path.slice(projectFolder.uri.fsPath.length + 1);

            const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
              AppmapConfigManager,
              projectFolder
            );
            assert(appmapConfigManagerInstance);
            const detectedAppMapDir = (await appmapConfigManagerInstance.getAppmapConfig())
              ?.appmapDir;

            if (detectedAppMapDir && path.startsWith(detectedAppMapDir)) {
              const filename = basename(path);
              const appmapFolder = path.slice(
                detectedAppMapDir.length + 1,
                path.length - filename.length - 1
              );
              label.unshift(`[${appmapFolder}]`);
            }
          }

          const itemLabel = label.join(' ');
          const item: vscode.QuickPickItem = {
            label: itemLabel,
            description: timeAgo(appmap.descriptor.timestamp, now),
            detail: path,
          };
          // Store the URI in a map keyed by the detail (file path) which is unique
          uriMap.set(path, appmap.descriptor.resourceUri);
          return item;
        })
    )
  ).sort((a, b) => a.label.localeCompare(b.label));
  const result = await vscode.window.showQuickPick(items);
  if (!result) return;

  return uriMap.get(result.detail!);
}
