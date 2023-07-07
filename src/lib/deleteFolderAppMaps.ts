import AppMapCollection from '../services/appmapCollection';
import deleteAppMap from './deleteAppMap';
import { AppMapTreeDataProvider } from '../tree/appMapTreeDataProvider';

export default async function deleteFolderAppMaps(
  appmaps: AppMapCollection,
  folderName: string
): Promise<number> {
  const filteredAppMaps = appmaps.appMaps().filter((appmap) => {
    const folderProperties = AppMapTreeDataProvider.appMapFolderItems(appmap);
    return AppMapTreeDataProvider.folderName(folderProperties) === folderName;
  });
  await Promise.all(
    filteredAppMaps.map((appmap) => deleteAppMap(appmap.descriptor.resourceUri, appmaps))
  );
  return filteredAppMaps.length;
}
