import { Uri } from 'vscode';
import { join } from 'node:path';
import * as log from './log';
import tryRequest from './tryRequest';
import { VersionResolver } from './versionResolver';
import DownloadUrlResolver from './downloadUrlResolver';
import * as ResourceVersions from '../../resources/versions.json';

export class MavenVersionResolver implements VersionResolver {
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

export class NpmVersionResolver implements VersionResolver {
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

export class StaticVersionResolver implements VersionResolver {
  constructor(private readonly resourceName: string) {}

  async getLatestVersion(): Promise<string | undefined> {
    return (ResourceVersions as Record<string, string>)[this.resourceName];
  }
}

interface GitHubRelease {
  tag_name: string;
}

// exported mainly for testing purposes
export const GithubReleaseCache = new Map<string, Promise<GitHubRelease[] | undefined>>();

async function fetchGitHubReleases(repo: string): Promise<GitHubRelease[] | undefined> {
  if (GithubReleaseCache.has(repo)) {
    return GithubReleaseCache.get(repo);
  }

  const promise = (async () => {
    const res = await tryRequest(`https://api.github.com/repos/${repo}/releases`);
    if (res) {
      try {
        const json = (await res.json()) as GitHubRelease[];
        if (Array.isArray(json)) {
          return json.map((release) => ({ tag_name: release.tag_name }));
        }
      } catch (e) {
        log.warning(`Failed to retrieve ${repo} releases from GitHub: ${e}`);
      }
    }
    return undefined;
  })();

  GithubReleaseCache.set(repo, promise);
  return promise;
}

export class GitHubReleaseResolver implements VersionResolver {
  constructor(private readonly repo: string, private readonly prefix = 'v') {}

  async getLatestVersion(): Promise<string | undefined> {
    const releases = await fetchGitHubReleases(this.repo);
    if (!releases) return undefined;

    const stableVersionRegex = /^\d+\.\d+\.\d+$/;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    for (const { tag_name } of releases) {
      if (tag_name?.startsWith(this.prefix)) {
        const version = tag_name.substring(this.prefix.length);
        if (stableVersionRegex.test(version)) return version;
      }
    }
  }
}

export class GitHubDownloadUrlResolver implements DownloadUrlResolver {
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

export class MavenDownloadUrlResolver implements DownloadUrlResolver {
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
    if (version === (ResourceVersions as Record<string, string>)[this.resourceName]) {
      const uri = Uri.file(join(BundledFileDownloadUrlResolver.resourcePath, this.resourceName));
      return uri.toString();
    }
  }

  public static extensionDirectory = '';

  public static get resourcePath() {
    return join(this.extensionDirectory, 'resources');
  }
}
