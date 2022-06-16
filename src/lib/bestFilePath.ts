import { isAbsolute, join } from 'path';
import * as vscode from 'vscode';

export async function bestFilePath(
  path: string,
  folder?: vscode.WorkspaceFolder,
  prompt = 'Choose file to open'
): Promise<vscode.Uri | undefined> {
  if (isAbsolute(path)) return vscode.Uri.file(path);

  const searchFolders = folder ? [folder] : vscode.workspace.workspaceFolders;

  let pathInFolder: string | undefined;
  if (searchFolders) {
    for (let i = 0; !pathInFolder && i < searchFolders.length; ++i) {
      const folder = searchFolders[i];
      // findFiles is not tolerant of absolute paths, even if the absolute path matches the
      // path of the file in the workspace.
      if (folder.uri.scheme === 'file' && path.startsWith(folder.uri.path)) {
        pathInFolder = path.slice(folder.uri.path.length + 1);
      }
    }
  }

  const searchPath = join('**', path);
  return new Promise<vscode.Uri | undefined>((resolve) => {
    vscode.workspace.findFiles(searchPath).then((uris) => {
      if (uris.length === 0) {
        resolve(undefined);
      } else if (uris.length === 1) {
        return resolve(uris[0]);
      } else {
        const options: vscode.QuickPickOptions = {
          canPickMany: false,
          placeHolder: prompt,
        };
        vscode.window
          .showQuickPick(
            uris.map((uri) => uri.toString()),
            options
          )
          .then((fileName) => resolve(fileName ? vscode.Uri.parse(fileName) : undefined));
      }
    });
  });
}
