import * as vscode from 'vscode';
import { PathLike, promises as fs } from 'fs';
import { join } from 'path';
import ignore from 'ignore';
import VersionControlProperties from './versionControl';

async function ignoresForWorkspaceFolder(wsFolder: vscode.WorkspaceFolder): Promise<unknown> {
  const directories = [wsFolder.uri.fsPath];
  const wsIgnore = ignore();

  for (;;) {
    const currentDirectory = directories.pop() as string;
    if (!currentDirectory) {
      break;
    }

    const files = await fs.readdir(currentDirectory, { withFileTypes: true });
    const gitIgnore = files.find((file) => file.isFile() && file.name === '.gitignore');
    if (gitIgnore) {
      wsIgnore.add(join(currentDirectory, gitIgnore.name));
    }

    files.filter((file) => {
      if (!file.isDirectory()) {
        return false;
      }

      const fullPath = join(currentDirectory, file.name);
      if (!wsIgnore.ignores(fullPath)) {
        directories.push(fullPath);
      }
    });
  }

  return wsIgnore;
}
export default class GitProperties implements VersionControlProperties {
  private ignore;

  public async initialize(): Promise<void> {
    this.ignore = ignore();

    const { workspaceFolders } = vscode.workspace;
    if (workspaceFolders) {
      const workspaceIgnores = await Promise.all(
        workspaceFolders.map(async (wsFolder) => await ignoresForWorkspaceFolder(wsFolder))
      );
      this.ignore.add(workspaceIgnores);
    }
  }

  public isIgnored(path: PathLike): boolean {
    return this.ignore.ignores(path as string);
  }
}
