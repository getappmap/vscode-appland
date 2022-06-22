import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { default as ignore, Ignore } from 'ignore';
import VersionControlProperties from './versionControl';

type DirIgnore = {
  ignore: Ignore;
  dir: string;
};

async function buildIgnore(ignoreFileName: string): Promise<Ignore> {
  const wsIgnore = ignore();
  wsIgnore.add(await fs.readFile(ignoreFileName, 'utf-8'));
  return wsIgnore;
}

export default class GitProperties implements VersionControlProperties {
  private ignores: DirIgnore[] = [];

  public async initialize(dir: string): Promise<void> {
    this.ignores = await Promise.all(
      (
        await vscode.workspace.findFiles(new vscode.RelativePattern(dir, '**/.gitignore'))
      ).map(async (uri) => ({ dir: dirname(uri.fsPath), ignore: await buildIgnore(uri.fsPath) }))
    );
  }

  public isIgnored(filePath: string): boolean {
    return !!this.ignores.find((ignore) => {
      if (!filePath.startsWith(ignore.dir)) return false;

      const relativePath = filePath.slice(ignore.dir.length + 1);
      return ignore.ignore.ignores(relativePath);
    });
  }
}
