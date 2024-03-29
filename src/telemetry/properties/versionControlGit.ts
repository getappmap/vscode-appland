import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { default as ignore, Ignore } from 'ignore';
import VersionControlProperties from './versionControl';
import { findFiles } from '../../lib/findFiles';

type DirIgnore = {
  ignore: Ignore;
  dir: string;
};

export async function buildIgnore(ignoreFileName: string): Promise<Ignore> {
  const wsIgnore = ignore();

  let buffer: string | Buffer;
  try {
    buffer = await fs.readFile(ignoreFileName, 'utf-8');
  } catch (e) {
    console.warn(`Failed to read ${ignoreFileName}. It's content will be ignored.`);
    return wsIgnore;
  }

  const ignoreLines = buffer
    .toString()
    .split(/\r?\n/gm)
    .map((line) => line.replace(/\\+$/, ''));

  ignoreLines.forEach((line) => wsIgnore.add(line));

  return wsIgnore;
}

export default class GitProperties implements VersionControlProperties {
  private ignores: DirIgnore[] = [];

  public async initialize(dir: string): Promise<void> {
    this.ignores = await Promise.all(
      (
        await findFiles(new vscode.RelativePattern(dir, '**/.gitignore'))
      ).map(async (uri) => ({ dir: dirname(uri.fsPath), ignore: await buildIgnore(uri.fsPath) }))
    );
  }

  public isIgnored(filePath: string): boolean {
    return !!this.ignores.find((ignore) => {
      if (!filePath.startsWith(ignore.dir)) return false;

      const relativePath = filePath.slice(ignore.dir.length + 1).replace(/^[/\\]+/, '');
      if (!relativePath) return false;

      return ignore.ignore.ignores(relativePath);
    });
  }
}
