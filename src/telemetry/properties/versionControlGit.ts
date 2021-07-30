import * as vscode from 'vscode';
import { PathLike, promises as fs } from 'fs';
import { join, dirname } from 'path';
import globToRegExp from 'glob-to-regexp';
import VersionControlProperties from './versionControl';

async function regexFromGitIgnore(filePath: PathLike): Promise<readonly RegExp[]> {
  const directory = dirname(filePath as string);
  const content = await fs.readFile(filePath);
  return content
    .toString()
    .replace(/#.*$/gm, '')
    .split(/^/gm)
    .map((line) => line.trim().replace(/^\//, `${directory}/`))
    .filter((line) => line !== '')
    .map((glob) => globToRegExp(glob, { flags: 'g' }));
}

async function ignoresForWorkspaceFolder(
  wsFolder: vscode.WorkspaceFolder
): Promise<readonly RegExp[]> {
  const directories = [wsFolder.uri.fsPath];
  const allGitIgnores: RegExp[] = [/\.git/];

  for (;;) {
    const currentDirectory = directories.pop() as string;
    if (!currentDirectory) {
      break;
    }

    const files = await fs.readdir(currentDirectory, { withFileTypes: true });
    const gitIgnore = files.find((file) => file.isFile() && file.name === '.gitignore');
    if (gitIgnore) {
      const gitIgnores = await regexFromGitIgnore(join(currentDirectory, gitIgnore.name));
      gitIgnores.forEach((re) => allGitIgnores.push(re));
    }

    files.filter((file) => {
      if (!file.isDirectory()) {
        return false;
      }

      const fullPath = join(currentDirectory, file.name);
      const isIgnored = allGitIgnores.some((re) => re.test(fullPath));
      if (!isIgnored) {
        directories.push(fullPath);
      }
    });
  }

  return allGitIgnores;
}

async function getIgnoreGlobs(): Promise<readonly RegExp[]> {
  const { workspaceFolders } = vscode.workspace;
  if (!workspaceFolders) {
    return Promise.resolve([]);
  }

  const workspaceIgnores = await Promise.all(
    workspaceFolders.map(async (wsFolder) => await ignoresForWorkspaceFolder(wsFolder))
  );

  return workspaceIgnores.flat();
}

export default class GitProperties implements VersionControlProperties {
  private ignoreRegex: readonly RegExp[] = [];

  public async initialize(): Promise<void> {
    this.ignoreRegex = await getIgnoreGlobs();
  }

  public isIgnored(path: PathLike): boolean {
    if (!this.ignoreRegex) {
      return false;
    }
    const result = this.ignoreRegex.some((re) => re.test(path as string));
    return result;
  }
}
