import * as vscode from 'vscode';
import { PathLike, promises as fs } from 'fs';
import { join, dirname } from 'path';
import globToRegExp from 'glob-to-regexp';
import VersionControlProperties from './versionControl';

async function getIgnoreGlobs() {
  const gitIgnoreUris = await vscode.workspace.findFiles('**/.gitignore');
  return (
    await Promise.all(
      gitIgnoreUris.map((uri) => {
        const rootDir = dirname(uri.fsPath);

        return fs.readFile(uri.fsPath).then((buf) =>
          buf
            .toString()
            .split(/^/gm)
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .map((glob) => join(rootDir, glob))
        );
      })
    )
  )
    .flat()
    .map((glob) => globToRegExp(glob));
}

export default class GitProperties implements VersionControlProperties {
  private ignoreRegex: Array<RegExp> | undefined;

  public async initialize(): Promise<void> {
    this.ignoreRegex = await getIgnoreGlobs();
  }

  public isIgnored(path: PathLike): boolean {
    if (!this.ignoreRegex) {
      return false;
    }

    return this.ignoreRegex.some((re) => re.test(path as string));
  }
}
