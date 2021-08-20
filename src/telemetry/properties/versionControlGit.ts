import * as vscode from 'vscode';
import { PathLike, promises as fs } from 'fs';
import path from 'path';
import { default as ignore, Ignore } from 'ignore';
import VersionControlProperties from './versionControl';

async function ignoresForWorkspaceFolder(wsFolder: string): Promise<Ignore> {
  const directories: Array<string> = [wsFolder];
  const wsIgnore: Ignore = ignore();

  for (;;) {
    const currentDirectory = directories.pop() as string;
    if (!currentDirectory) {
      break;
    }

    const files = await fs.readdir(currentDirectory, { withFileTypes: true });
    const gitIgnore = files.find((file) => file.isFile() && file.name === '.gitignore');
    if (gitIgnore) {
      wsIgnore.add((await fs.readFile(path.join(currentDirectory, gitIgnore.name))).toString());
    }

    files.filter((file) => {
      if (!file.isDirectory()) {
        return false;
      }

      const fullPath = path.join(currentDirectory, file.name);
      if (!wsIgnore.ignores(file.name)) {
        directories.push(fullPath);
      }
    });
  }

  return wsIgnore;
}
export default class GitProperties implements VersionControlProperties {
  private ignores: Record<string, Ignore> = {};

  public async initialize(): Promise<void> {
    const { workspaceFolders } = vscode.workspace;
    if (workspaceFolders) {
      for (const wsFolder of workspaceFolders) {
        const path = wsFolder.uri.fsPath;
        this.ignores[path] = await ignoresForWorkspaceFolder(path);
      }
    }
  }

  public isIgnored(filePath: PathLike): boolean {
    const rootFolder = path.parse(filePath as string).root;

    let filename = path.basename(filePath as string);
    let dirname = path.dirname(filePath as string);

    for (;;) {
      if (this.ignores[dirname] && this.ignores[dirname]?.ignores(filename)) {
        return true;
      }

      if (dirname !== rootFolder) {
        filename = path.join(path.basename(dirname), filename);
        dirname = path.dirname(dirname);
      } else {
        break;
      }
    }

    return false;
  }
}
