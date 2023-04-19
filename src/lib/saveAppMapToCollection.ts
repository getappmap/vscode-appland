import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import { glob } from 'glob';
import { basename, join, relative } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { fileExists, getWorkspaceFolderFromPath } from '../util';
import { AppmapConfigManager, AppmapConfigManagerInstance } from '../services/appmapConfigManager';
import { workspaceServices } from '../services/workspaceServices';
import assert from 'assert';

const CREATE_NEW_PROMPT = '<create>';

export default async function saveAppMapToCollection(
  projectStates: ReadonlyArray<ProjectStateServiceInstance>,
  appmapUri: vscode.Uri
): Promise<string | undefined> {
  const projectFolder = getWorkspaceFolderFromPath(projectStates, appmapUri.fsPath);
  if (!projectFolder) {
    vscode.window.showErrorMessage(`Cannot determine workspace folder for ${appmapUri.fsPath}`);
    return;
  }

  let appmapDir: string | undefined;
  let configFolder = projectFolder.uri.fsPath;

  const appmapConfigManagerInstance = workspaceServices().getServiceInstanceFromClass(
    AppmapConfigManager,
    projectFolder
  ) as AppmapConfigManagerInstance | undefined;
  assert(appmapConfigManagerInstance);

  const appmapConfig = await appmapConfigManagerInstance.getAppmapConfig();

  if (appmapConfig) {
    const appmapDirFullPath = join(appmapConfig.configFolder, appmapConfig.appmapDir);
    appmapDir = relative(projectFolder.uri.fsPath, appmapDirFullPath);
    configFolder = appmapConfig.configFolder;
  }

  if (appmapConfig?.usingDefault || appmapConfigManagerInstance.isUsingDefaultConfig) {
    appmapDir = await vscode.window.showInputBox({
      title: `Enter the AppMap directory for project ${projectFolder.name}`,
    });
    if (!appmapDir) return;

    if (!(await fileExists(join(projectFolder.uri.fsPath, appmapDir)))) {
      vscode.window.showInformationMessage(`Folder '${appmapDir}' does not exist`);
      return;
    }

    if (appmapConfig && appmapConfigManagerInstance.hasConfigFile)
      await appmapConfigManagerInstance.saveAppMapDir(appmapConfig.configFolder, appmapDir);
  }
  if (!appmapDir) return;

  const collectionsDir = join(configFolder, appmapDir, 'collections');

  let collectionNames: string[];
  {
    const folderContents = await promisify(glob)(`${collectionsDir}/*`);
    const isDirectory = new Map<string, boolean>();
    await Promise.all(
      folderContents.map(async (file) =>
        isDirectory.set(file, !file.startsWith('.') && (await stat(file)).isDirectory())
      )
    );
    collectionNames = folderContents
      .filter((file) => isDirectory.get(file))
      .map((file) => file.slice(collectionsDir.length + 1));
  }
  let collectionName: string | undefined = await vscode.window.showQuickPick(
    [CREATE_NEW_PROMPT, ...collectionNames],
    {
      title: 'Create or select a collection',
    }
  );
  if (!collectionName) return;

  if (collectionName === CREATE_NEW_PROMPT) {
    collectionName = await vscode.window.showInputBox({
      title: `Enter collection name in ${projectFolder.name}`,
    });
  }

  if (!collectionName) return;

  collectionName = collectionName.replaceAll(/[^a-zA-Z0-9\-_]/g, '_');
  const collectionDir = join(collectionsDir, collectionName);
  await mkdir(collectionDir, { recursive: true });

  const appmap = JSON.parse(await readFile(appmapUri.fsPath, 'utf-8'));
  if (!appmap['metadata']) appmap.metadata = {};
  appmap.metadata['collection'] = collectionName;

  const appmapFileName = basename(appmapUri.fsPath);
  await writeFile(join(collectionDir, appmapFileName), JSON.stringify(appmap, null, 2));

  return collectionName;
}
