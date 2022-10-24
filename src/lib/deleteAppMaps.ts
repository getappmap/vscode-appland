import * as vscode from 'vscode';
import deleteAppMap from './deleteAppMap';

export default async function deleteAppMaps(path: string): Promise<number> {
  const appmapFiles = await vscode.workspace.findFiles(
    new vscode.RelativePattern(vscode.Uri.file(path), '**/*.appmap.json'),
    `**/node_modules/**`
  );

  await Promise.all(appmapFiles.map(deleteAppMap.bind(null)));

  return appmapFiles.length;
}
