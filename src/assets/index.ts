import { chmod, copyFile, mkdir, open, symlink, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { Uri } from 'vscode';

import DownloadUrlResolver from './downloadUrlResolver';
import * as log from './log';
import { VersionResolver } from './versionResolver';
import { fileExists } from '../util';
import tryRequest from './tryRequest';
import * as ResourceVersions from '../../resources/versions.json';
import downloadHttpRetry from './downloadHttpRetry';

class MavenVersionResolver implements VersionResolver {
  constructor(private readonly groupId: string, private readonly artifactId: string) {}

  async getLatestVersion(): Promise<string | undefined> {
    const res = await tryRequest(
      `https://repo1.maven.org/maven2/${this.groupId.replace(/\./g, '/')}/${
        this.artifactId
      }/maven-metadata.xml`
    );
    if (res) {
      try {
        const text = await res.text();
        const match = /<release>(.*?)<\/release>/.exec(text);
        return match?.[1];
      } catch (e: unknown) {
        log.warning(`Failed to retrieve ${this.artifactId} version from Maven: ${e}`);
      }
    }
  }
}
class NpmVersionResolver implements VersionResolver {
  constructor(private readonly packageName: string) {}

  async getLatestVersion(): Promise<string | undefined> {
    const res = await tryRequest(`https://registry.npmjs.org/${this.packageName}/latest`);
    if (res) {
      try {
        const json: { version?: string } = (await res.json()) as Record<string, unknown>;
        return json.version;
      } catch (e: unknown) {
        log.warning(`Failed to retrieve ${this.packageName} version from NPM: ${e}`);
      }
    }
  }
}

class StaticVersionResolver implements VersionResolver {
  constructor(private readonly resourceName: string) {}

  async getLatestVersion(): Promise<string | undefined> {
    return ResourceVersions[this.resourceName];
  }
}

class GitHubVersionResolver implements VersionResolver {
  constructor(private readonly repo: string) {}

  async getLatestVersion(): Promise<string | undefined> {
    const res = await tryRequest(`https://api.github.com/repos/${this.repo}/releases/latest`);
    if (res) {
      try {
        const json: { tag_name?: string } = (await res.json()) as Record<string, unknown>;
        return json.tag_name?.replace(/^v/, '');
      } catch (e: unknown) {
        log.warning(`Failed to retrieve ${this.repo} version from GitHub: ${e}`);
      }
    }
  }
}

class GitHubDownloadUrlResolver implements DownloadUrlResolver {
  constructor(
    private readonly repo: string,
    private readonly artifactName: string | ((version: string) => string)
  ) {}

  async getDownloadUrl(version: string): Promise<string> {
    const artifactName =
      typeof this.artifactName === 'function' ? this.artifactName(version) : this.artifactName;
    return `https://github.com/${this.repo}/releases/download/${artifactName}`;
  }
}

class MavenDownloadUrlResolver implements DownloadUrlResolver {
  constructor(private readonly groupId: string, private readonly artifactId: string) {}

  async getDownloadUrl(version: string): Promise<string> {
    return `https://repo1.maven.org/maven2/${this.groupId.replace(/\./g, '/')}/${
      this.artifactId
    }/${version}/${this.artifactId}-${version}.jar`;
  }
}

export class BundledFileDownloadUrlResolver implements DownloadUrlResolver {
  constructor(private readonly resourceName: string) {}

  async getDownloadUrl(version: string): Promise<string | undefined> {
    if (version === ResourceVersions[this.resourceName]) {
      const uri = Uri.file(join(BundledFileDownloadUrlResolver.resourcePath, this.resourceName));
      return uri.toString();
    }
  }

  public static extensionDirectory = '';

  public static get resourcePath() {
    return join(this.extensionDirectory, 'resources');
  }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const binaryName = (name: string) => (process.platform === 'win32' ? `${name}.exe` : name);

// These are not cached because homdir may change in testing
const globalAppMapDir = () => join(homedir(), '.appmap');
const appMapBinDir = () => join(globalAppMapDir(), 'bin');
const appMapJavaAgentDir = () => join(globalAppMapDir(), 'lib', 'java');

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

// If this file doesn't exist, we redownload all the assets because the
// user can be in a broken state from a previous version.
const downloadMarkerPath = () => join(globalAppMapDir(), '.download-complete');
export function isInitialDownloadCompleted(): Promise<boolean> {
  return fileExists(downloadMarkerPath());
}

export async function initialDownloadCompleted(): Promise<void> {
  return (await open(downloadMarkerPath(), 'w')).close();
}

async function downloadRequired(assetPath: string): Promise<boolean> {
  try {
    if (!(await isInitialDownloadCompleted())) return true;
    const exists = await fileExists(assetPath);
    return !exists;
  } catch {
    return true;
  }
}

// checks if a path exists and is readable
async function targetMissing(binaryPath: string) {
  try {
    await (await open(binaryPath, 'r')).close();
    return false;
  } catch {
    return true;
  }
}

async function download(url: Uri, destinationPath: string): Promise<void> {
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

export function getPlatformIdentifier() {
  switch (process.platform) {
    case 'win32':
      return `win-${process.arch}`;
    case 'darwin':
      return `macos-${process.arch}`;
    default:
      return `linux-${process.arch}`;
  }
}

async function resolveVersion(resolvers: VersionResolver[]) {
  for (const resolver of resolvers) {
    const result = await resolver.getLatestVersion();
    if (result) return result;
  }
}

async function resolveUrl(resolvers: DownloadUrlResolver[], version: string) {
  for (const resolver of resolvers) {
    const result = await resolver.getDownloadUrl(version);
    if (result) return result;
  }
}

async function downloadCliAsset(name: string) {
  const pkgName = '@appland/' + name;
  const version = await resolveVersion([
    new NpmVersionResolver(pkgName),
    new StaticVersionResolver(name),
  ]);
  if (!version) throw new Error(`Error resolving ${name} version`);

  const platformId = getPlatformIdentifier();
  const binaryVerName = binaryName(`${name}-${platformId}-${version}`);

  const binaryPath = join(cacheDir(), binaryVerName);
  const symlinkPath = join(appMapBinDir(), binaryName(name));

  if (await downloadRequired(binaryPath)) {
    const uri = await new GitHubDownloadUrlResolver('getappmap/appmap-js', (version) =>
      encodeURIComponent(
        binaryName(`@appland/${name}-v${version}/${name}-${getPlatformIdentifier()}`)
      )
    ).getDownloadUrl(version);
    await download(Uri.parse(uri), binaryPath);
    await markExecutable(binaryPath);
    await updateSymlink(binaryPath, symlinkPath);
  } else if (await targetMissing(symlinkPath)) {
    await updateSymlink(binaryPath, symlinkPath);
  }
}

export const AppMapCliDownloader = () => downloadCliAsset('appmap');
export const ScannerDownloader = () => downloadCliAsset('scanner');
export const JavaAgentDownloader = async () => {
  const version = await resolveVersion([
    new MavenVersionResolver('com.appland', 'appmap-agent'),
    new GitHubVersionResolver('getappmap/appmap-java'),
    new StaticVersionResolver('appmap-java.jar'),
  ]);
  if (!version) throw new Error(`Error resolving AppMap Java agent version`);

  const binaryPath = join(cacheDir(), `appmap-${version}.jar`);
  const symlinkPath = join(appMapJavaAgentDir(), 'appmap.jar');

  if (await downloadRequired(binaryPath)) {
    const uri = await resolveUrl(
      [
        new BundledFileDownloadUrlResolver('appmap-java.jar'),
        new MavenDownloadUrlResolver('com.appland', 'appmap-agent'),
        new GitHubDownloadUrlResolver(
          'getappmap/appmap-java',
          (version) => `v${version}/appmap-${version}.jar`
        ),
      ],
      version
    );
    if (!uri) throw new Error(`Error resolving AppMap Java agent download URL`);
    await download(Uri.parse(uri), binaryPath);
    await markExecutable(binaryPath);
    await updateSymlink(binaryPath, symlinkPath);
  } else if (await targetMissing(symlinkPath)) {
    await updateSymlink(binaryPath, symlinkPath);
  }
};
