import * as vscode from 'vscode';
import deleteAppMap from './deleteAppMap';
import closeEditorByUri from './closeEditorByUri';
import { promisify } from 'util';
import { glob } from 'glob';
import AppMapCollection from '../services/appmapCollection';

export default async function deleteAppMaps(
  path: string,
  appMapCollection: AppMapCollection
): Promise<number> {
  // Use glob instead of the vscode find facility to bypass the find exclusion rules
  // that might hide the AppMaps we are looking for.
  const appmapFiles = (await promisify(glob)(`${path}/**/*.appmap.json`)).map((path) =>
    vscode.Uri.file(path)
  );

  await Promise.all(
    appmapFiles.map((uri) => {
      deleteAppMap(uri, appMapCollection);
      closeEditorByUri(uri);
    })
  );
  appMapCollection.clear();

  return appmapFiles.length;
}
