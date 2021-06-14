import * as fs from 'fs';
import * as path from 'path';
import { workspace } from 'vscode';
import { createHash } from 'crypto';

const APPMAP_CONFIG_FILE = 'appmap.yml';
const APPMAP_FILE_EXT = '.appmap.json';

function getRelativeDir(filePath: string): string {
  const baseDirs = workspace.workspaceFolders;

  if (baseDirs !== undefined) {
    for (const dir of baseDirs) {
      const relPath = path.relative(dir.uri.fsPath, filePath);
      if (!relPath.startsWith('..')) return path.dirname(relPath);
    }
  }

  return path.dirname(filePath);
}

function getFileType(baseName: string, dirPath: string): string {
  if (baseName == APPMAP_CONFIG_FILE && dirPath == '.') {
    return 'appmap_config';
  } else if (baseName.endsWith(APPMAP_FILE_EXT)) {
    return 'appmap';
  } else {
    return 'source_code';
  }

  // TODO: How do we determine project_config?
}

async function getFileHash(file: fs.PathLike): Promise<string> {
  const hash = createHash('sha256');
  hash.update(await fs.promises.readFile(file));
  return hash.digest('hex');
}

export async function getFileProperties(
  file: fs.PathLike
): Promise<Record<string, string | number>> {
  const fileStats = await fs.promises.stat(file);
  if (!fileStats.isFile()) throw new Error(`Not a regular file: ${file}`);

  const filePath = await fs.promises.realpath(file);
  const fileDir = getRelativeDir(filePath);

  const properties = {
    'appmap.file.dir': fileDir,
    'appmap.file.sha_256': await getFileHash(file),
    'appmap.file.size': fileStats.size,
    'appmap.file.type': getFileType(path.basename(filePath), fileDir),
  };

  return properties;
}
