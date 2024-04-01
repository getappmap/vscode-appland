import { join } from 'path';
import { homedir } from 'os';
import { createWriteStream } from 'fs';
import { chmod, copyFile, mkdir, symlink, unlink } from 'fs/promises';
import { Uri } from 'vscode';
import AssetDownloader from './assetDownloader';
import DownloadUrlResolver from './downloadUrlResolver';
import { VersionResolver } from './versionResolver';
import { fileExists } from '../util';
import tryRequest from './tryRequest';
import AssetService from './assetService';
import * as ResourceVersions from '../../resources/versions.json';

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
        AssetService.logWarning(`Failed to retrieve ${this.artifactId} version from Maven: ${e}`);
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
        AssetService.logWarning(`Failed to retrieve ${this.packageName} version from NPM: ${e}`);
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
        AssetService.logWarning(`Failed to retrieve ${this.repo} version from GitHub: ${e}`);
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

class BundledFileDownloadUrlResolver implements DownloadUrlResolver {
  constructor(private readonly resourceName: string) {}

  async getDownloadUrl(version: string): Promise<string | undefined> {
    if (version === ResourceVersions[this.resourceName]) {
      const uri = Uri.file(join(AssetService.extensionDirectory, 'resources', this.resourceName));
      return uri.toString();
    }
  }
}

// These are not cached because homdir may change in testing
const globalAppMapDir = () => join(homedir(), '.appmap');
const appMapCliLibDir = () => join(globalAppMapDir(), 'lib', 'appmap');
const scannerCliLibDir = () => join(globalAppMapDir(), 'lib', 'scanner');
const appMapBinDir = () => join(globalAppMapDir(), 'bin');
const appMapJavaAgentDir = () => join(globalAppMapDir(), 'lib', 'java');

async function isAssetMissing(assetPath: string): Promise<boolean> {
  try {
    const exists = await fileExists(assetPath);
    return !exists;
  } catch {
    return false;
  }
}

function writeToFile(stream: NodeJS.ReadableStream, path: string, flags?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const fileWriter = createWriteStream(path, { flags });

    fileWriter.on('error', reject);
    fileWriter.on('finish', resolve);

    stream.on('error', (error) => {
      fileWriter.end();
      reject(error);
    });

    stream.pipe(fileWriter);
  });
}

async function markExecutable(path: string): Promise<void> {
  try {
    await chmod(path, 0o755);
  } catch (e) {
    AssetService.logWarning(`Failed to mark ${path} as executable: ${e}`);
  }
}

async function updateSymlink(assetPath: string, symlinkPath: string): Promise<void> {
  try {
    await unlink(symlinkPath);
  } catch {
    // if the symlink that we're trying to remove does not exist, don't do anything
  }

  try {
    await symlink(assetPath, symlinkPath, 'file');
  } catch (e) {
    await copyFile(assetPath, symlinkPath);
  }
}

export const AppMapCliDownloader = new AssetDownloader(
  'AppMap CLI',
  [new NpmVersionResolver('@appland/appmap'), new StaticVersionResolver('appmap')],
  [
    new GitHubDownloadUrlResolver('getappmap/appmap-js', (version) =>
      encodeURIComponent(`@appland/appmap-v${version}/appmap-${process.platform}-${process.arch}`)
    ),
  ],
  {
    shouldDownload: (version: string) =>
      isAssetMissing(join(appMapCliLibDir(), `appmap-v${version}`)),
    beforeDownload: () => mkdir(appMapCliLibDir(), { recursive: true }) as Promise<void>,
    download: (stream, version) =>
      writeToFile(stream, join(appMapCliLibDir(), `appmap-v${version}`), 'wx'),
    async afterDownload(version) {
      const binaryPath = join(appMapCliLibDir(), `appmap-v${version}`);
      const symlinkPath = join(appMapBinDir(), 'appmap');
      await markExecutable(binaryPath);
      await updateSymlink(binaryPath, symlinkPath);
    },
  }
);

export const ScannerDownloader = new AssetDownloader(
  'AppMap Scanner CLI',
  [new NpmVersionResolver('@appland/scanner'), new StaticVersionResolver('scanner')],
  [
    new GitHubDownloadUrlResolver('getappmap/appmap-js', (version) =>
      encodeURIComponent(`@appland/scanner-v${version}/scanner-${process.platform}-${process.arch}`)
    ),
  ],
  {
    shouldDownload: (version: string) =>
      isAssetMissing(join(scannerCliLibDir(), `scanner-v${version}`)),
    beforeDownload: () => mkdir(scannerCliLibDir(), { recursive: true }) as Promise<void>,
    download: (stream, version) =>
      writeToFile(stream, join(scannerCliLibDir(), `scanner-v${version}`), 'wx'),
    async afterDownload(version) {
      const binaryPath = join(scannerCliLibDir(), `scanner-v${version}`);
      const symlinkPath = join(appMapBinDir(), 'scanner');
      await markExecutable(binaryPath);
      await updateSymlink(binaryPath, symlinkPath);
    },
  }
);

export const JavaAgentDownloader = new AssetDownloader(
  'AppMap Java Agent',
  [
    new MavenVersionResolver('com.appland', 'appmap-agent'),
    new GitHubVersionResolver('getappmap/appmap-java'),
    new StaticVersionResolver('appmap-java.jar'),
  ],
  [
    new BundledFileDownloadUrlResolver('appmap-java.jar'),
    new MavenDownloadUrlResolver('com.appland', 'appmap-agent'),
    new GitHubDownloadUrlResolver(
      'getappmap/appmap-java',
      (version) => `v${version}/appmap-${version}.jar`
    ),
  ],
  {
    shouldDownload: (version: string) =>
      isAssetMissing(join(appMapJavaAgentDir(), `appmap-${version}.jar`)),
    beforeDownload: () => mkdir(appMapJavaAgentDir(), { recursive: true }) as Promise<void>,
    download: (stream, version) =>
      writeToFile(stream, join(appMapJavaAgentDir(), `appmap-${version}.jar`), 'wx'),
    async afterDownload(version) {
      const binaryPath = join(appMapJavaAgentDir(), `appmap-${version}.jar`);
      const symlinkPath = join(appMapJavaAgentDir(), 'appmap.jar');
      await updateSymlink(binaryPath, symlinkPath);
    },
  }
);
