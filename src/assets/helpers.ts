import { randomBytes } from 'node:crypto';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readdir,
  readlink,
  rename,
  rm,
  stat,
  symlink,
} from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
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
// Unpacked copy of the AppMap skills release: ~/.appmap/skills/<skill>
export const AppMapSkillsDir = () => join(GlobalAppMapDir(), 'skills');

// A path for the user to read, with the home directory abbreviated the way
// they'd write it themselves.
export function displayPath(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
}

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

export async function download(url: Uri, destinationPath: string, quiet = false): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true });
  switch (url.scheme) {
    case 'file':
      return copyFile(url.fsPath, destinationPath);
    case 'http':
    case 'https':
      return downloadHttpRetry(url, destinationPath, { quiet });
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

// Whether `path` already provides `assetPath`: a symlink resolving to it, or, where
// symlinks aren't available and we copy instead, a file of the same size. Different
// builds are practically never the same size, and comparing contents would mean reading
// a binary of a hundred megabytes on every start.
async function linkIsCurrent(path: string, assetPath: string): Promise<boolean> {
  try {
    const entry = await lstat(path);
    if (entry.isSymbolicLink())
      return resolve(dirname(path), await readlink(path)) === resolve(assetPath);
    return entry.isFile() && entry.size === (await stat(assetPath)).size;
  } catch {
    return false;
  }
}

// Points `symlinkPath` at `assetPath`, or copies it there where symlinks aren't available.
// Other windows run the tools from `symlinkPath`, so it's never removed, not even for a
// moment: a spawn that lands in the gap fails with ENOENT. Instead the replacement is made
// beside it and renamed over it, which swaps it in one step.
export async function updateSymlink(assetPath: string, symlinkPath: string): Promise<void> {
  if (await linkIsCurrent(symlinkPath, assetPath)) return;

  // make sure the target directory exists
  await mkdir(dirname(symlinkPath), { recursive: true });
  const temporaryPath = `${symlinkPath}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    try {
      await symlink(assetPath, temporaryPath, 'file');
    } catch {
      await copyFile(assetPath, temporaryPath);
    }
    await rename(temporaryPath, symlinkPath);
  } catch (e) {
    await rm(temporaryPath, { force: true });
    throw e;
  }
}

// Java agent jars under either naming scheme. appmap-<version>.jar is what
// upstream publishes on GitHub releases and what we write;
// appmap-agent-<version>.jar is Maven Central's repackaging under the
// artifactId, which is what the IntelliJ plugin ends up writing into
// ~/.appmap/lib/java. We read that directory, so we have to recognize both.
//
// Requiring a version in the name is what keeps other jars out. That same
// directory also holds runtime-<version>.jar, which the Java agent extracts
// there itself at run time (it holds com.appland.appmap.runtime.HookFunctions,
// a couple of KB); linking appmap.jar at one of those hands the JVM something
// it can't load as a -javaagent. It also excludes the appmap.jar symlink
// itself, which was otherwise listed as a candidate with an unparseable
// version.
const JAVA_AGENT_JAR = /^appmap(?:-agent)?-\d.*\.jar$/;

// The IntelliJ plugin's lock file convention: present and less than 5 minutes
// old means a download is in flight, older than that means it was abandoned.
const DOWNLOAD_LOCK_TIMEOUT_MS = 5 * 60 * 1000;

async function lockIsFresh(lockPath: string): Promise<boolean> {
  try {
    const { mtimeMs } = await stat(lockPath);
    return Date.now() - mtimeMs < DOWNLOAD_LOCK_TIMEOUT_MS;
  } catch {
    return false;
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
      const names = new Set(ents);
      for (const ent of ents) {
        if (ent.endsWith('.part')) continue; // skip partial downloads
        // We read ~/.appmap/lib/java, which the IntelliJ plugin owns, and it
        // downloads straight to the final path rather than staging a
        // temporary file the way we do -- so a jar there may be half-written.
        // It marks one in flight with a sibling .downloading lock, which it
        // considers stale after 5 minutes.
        if (names.has(`${ent}.downloading`) && (await lockIsFresh(join(dir, `${ent}.downloading`))))
          continue;
        if (
          (assetId === AssetIdentifier.JavaAgent && JAVA_AGENT_JAR.test(ent)) ||
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
