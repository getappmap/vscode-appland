import AppMapCollection from '../services/appmapCollection';
import deleteAppMap from './deleteAppMap';
import { AppMapTreeDataProvider } from '../tree/appMapTreeDataProvider';
import * as vscode from 'vscode';

export default async function deleteFolderAppMaps(
  appmaps: AppMapCollection,
  folderName: string
): Promise<number> {
  const filteredAppMaps = appmaps.appMaps().filter((appmap) => {
    const folderProperties = AppMapTreeDataProvider.appMapFolderItems(appmap);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(appmap.descriptor.resourceUri);
    return (
      AppMapTreeDataProvider.folderName(folderProperties) === folderName ||
      workspaceFolder?.name === folderName
    );
  });
  await Promise.all(
    filteredAppMaps.map((appmap) => deleteAppMap(appmap.descriptor.resourceUri, appmaps))
  );
  return filteredAppMaps.length;
}
