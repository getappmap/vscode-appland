import assert from 'assert';
import { basename } from 'path';
import * as vscode from 'vscode';
import AppMapLoader from '../services/appmapLoader';
import { getWorkspaceFolderFromPath, timeAgo } from '../util';
import { AppmapConfigManager, AppmapConfigManagerInstance } from '../services/appmapConfigManager';
import { workspaceServices } from '../services/workspaceServices';
import { AppMapQuickPickItem } from './AppMapQuickPickItem';

export async function promptForAppMap(
  appmaps: AppMapLoader[],
  exclude: vscode.Uri[] = []
): Promise<vscode.Uri | undefined> {
  const now = Date.now();
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
            ) as AppmapConfigManagerInstance | undefined;
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

          return {
            resourceUri: appmap.descriptor.resourceUri,
            label: label.join(' '),
            description: timeAgo(appmap.descriptor.timestamp, now),
            detail: path,
          } as AppMapQuickPickItem;
        })
    )
  ).sort((a, b) => a.label.localeCompare(b.label));
  const result = await vscode.window.showQuickPick<AppMapQuickPickItem>(items);
  if (!result) return;

  return result.resourceUri;
}
