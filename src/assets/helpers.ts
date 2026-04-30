import { chmod, copyFile, mkdir, open, readdir, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Uri } from 'vscode';
import semverClean from 'semver/functions/clean';
import semverCompareBuild from 'semver/functions/compare-build';

import * as log from './log';
import { fileExists } from '../util';
import downloadHttpRetry from './downloadHttpRetry';
import { AssetIdentifier, getPlatformIdentifier, versionFromPath } from './types';
import { BundledFileDownloadUrlResolver } from './resolvers';

// These are not cached because homdir may change in testing
export const GlobalAppMapDir = () => join(homedir(), '.appmap');
export const AppMapBinDir = () => join(GlobalAppMapDir(), 'bin');
export const AppMapJavaAgentDir = () => join(GlobalAppMapDir(), 'lib', 'java');

// return platform-appriopriate cache directory
export function cacheDir(): string {
  const home = homedir();
  switch (process.platform) {
    case 'win32':
      return process.env.LOCALAPPDATA
        ? join(process.env.LOCALAPPDATA, 'AppMap', 'cache')
        : join(home, 'AppData', 'Local', 'AppMap', 'cache');
    case 'darwin':
      return join(home, 'Library', 'Caches', 'AppMap');
    default:
      return process.env.XDG_CACHE_HOME
        ? join(process.env.XDG_CACHE_HOME, 'appmap')
        : join(home, '.cache', 'appmap');
  }
}

export async function downloadRequired(assetPath: string): Promise<boolean> {
  try {
    const exists = await fileExists(assetPath);
    return !exists;
  } catch {
    return true;
  }
}

// checks if a path exists and is readable
export async function targetMissing(binaryPath: string) {
  try {
    await (await open(binaryPath, 'r')).close();
    return false;
  } catch {
    return true;
  }
}

export async function download(url: Uri, destinationPath: string): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true });
  switch (url.scheme) {
    case 'file':
      return copyFile(url.fsPath, destinationPath);
    case 'http':
    case 'https':
      return downloadHttpRetry(url, destinationPath);
    default:
      return Promise.reject(`Unhandled scheme ${url.scheme}`);
  }
}

export async function markExecutable(path: string): Promise<void> {
  try {
    await chmod(path, 0o755);
  } catch (e) {
    log.warning(`Failed to mark ${path} as executable: ${e}`);
  }
}

export async function updateSymlink(assetPath: string, symlinkPath: string): Promise<void> {
  try {
    await unlink(symlinkPath);
  } catch {
    // if the symlink that we're trying to remove does not exist, don't do anything
  }

  // make sure the target directory exists
  await mkdir(dirname(symlinkPath), { recursive: true });
  try {
    await symlink(assetPath, symlinkPath, 'file');
  } catch (e) {
    await copyFile(assetPath, symlinkPath);
  }
}

export async function listAssets(assetId: AssetIdentifier): Promise<string[]> {
  const DIRS = [
    cacheDir(),
    BundledFileDownloadUrlResolver.resourcePath,
    join(GlobalAppMapDir(), 'lib', 'java'),
    join(GlobalAppMapDir(), 'lib', 'appmap'),
    join(GlobalAppMapDir(), 'lib', 'scanner'),
  ];
  const results: string[] = [];
  for (const dir of DIRS) {
    try {
      const ents = await readdir(dir);
      for (const ent of ents) {
        if (ent.endsWith('.part')) continue; // skip partial downloads
        if (
          (assetId === AssetIdentifier.JavaAgent && ent.endsWith('.jar')) ||
          (assetId === AssetIdentifier.AppMapCli &&
            ent.startsWith('appmap') &&
            ent.includes(getPlatformIdentifier())) ||
          (assetId === AssetIdentifier.ScannerCli &&
            ent.startsWith('scanner') &&
            ent.includes(getPlatformIdentifier()))
        ) {
          results.push(join(dir, ent));
        }
      }
    } catch (e) {
      // ignore, directory may not exist
    }
  }

  // sort by version descending
  results.sort((a, b) => {
    const va = semverClean(versionFromPath(a) ?? '', { loose: true });
    const vb = semverClean(versionFromPath(b) ?? '', { loose: true });
    if (va && vb) return -semverCompareBuild(va, vb);
    if (va) return -1;
    if (vb) return 1;
    return 0;
  });

  return results;
}
