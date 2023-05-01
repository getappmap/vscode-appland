import * as vscode from 'vscode';
import deleteAppMap from './deleteAppMap';
import { promisify } from 'util';
import { glob } from 'glob';

export default async function deleteAppMaps(path: string): Promise<number> {
  // Use glob instead of the vscode find facility to bypass the find exclusion rules
  // that might hide the AppMaps we are looking for.
  const appmapFiles = (await promisify(glob)(`${path}/**/*.appmap.json`)).map((path) =>
    vscode.Uri.file(path)
  );

  await Promise.all(appmapFiles.map(deleteAppMap.bind(null)));

  return appmapFiles.length;
}
