import AppMapCollection from '../services/appmapCollection';
import { IAppMapTreeItem } from '../tree/appMapTreeDataProvider';
import deleteAppMap from './deleteAppMap';

export default async function deleteFolderAppMaps(
  appmaps: AppMapCollection,
  selectedTreeItem: IAppMapTreeItem
): Promise<number> {
  let numDeleted = 0;
  const deleteTreeItem = async (treeItem: IAppMapTreeItem) => {
    if (treeItem.appmap) {
      await deleteAppMap(treeItem.appmap.descriptor.resourceUri, appmaps);
      numDeleted++;
    }
    for (const child of treeItem.children) deleteTreeItem(child);
  };
  await deleteTreeItem(selectedTreeItem);

  return numDeleted;
}
