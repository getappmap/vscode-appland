import { join } from 'node:path';
import vscode, { Uri } from 'vscode';
import semverClean from 'semver/functions/clean';
import semverCompareBuild from 'semver/functions/compare-build';

import * as log from './log';
import { AssetIdentifier, versionFromPath } from './types';
import {
  BundledFileDownloadUrlResolver,
  GitHubDownloadUrlResolver,
  GitHubReleaseResolver,
  MavenDownloadUrlResolver,
  MavenVersionResolver,
  StaticVersionResolver,
} from './resolvers';
import {
  AppMapJavaAgentDir,
  cacheDir,
  download,
  downloadRequired,
  listAssets,
  markExecutable,
  targetMissing,
  updateSymlink,
} from './helpers';
import { VersionResolver } from './versionResolver';
import DownloadUrlResolver from './downloadUrlResolver';

async function resolveVersion(resolvers: VersionResolver[]) {
  for (const resolver of resolvers) {
    const result = await resolver.getLatestVersion();
    if (result) return result;
  }
}

// Try each source in turn and keep the first download that succeeds.
//
// The obvious cheaper design is to probe each URL first and download from the
// one that answers, but a probe can only tell you about the probe. This chain
// exists because of proxies that treat one host differently from another, and
// those same proxies distinguish HEAD from GET, or the metadata path from the
// artifact path. Attempting the download is the only check that tests what we
// actually need, and in the happy path it's also one round trip rather than
// two. Each attempt runs quiet so that a refusal from one source doesn't put
// an error dialog in front of the user for a download that then succeeds from
// the next; we report once, here, if they all fail.
async function downloadFirstAvailable(
  resolvers: DownloadUrlResolver[],
  version: string,
  destination: string
): Promise<void> {
  const failures: string[] = [];
  for (const resolver of resolvers) {
    const url = await resolver.getDownloadUrl(version);
    if (!url) continue;
    try {
      await download(Uri.parse(url), destination, true);
      return;
    } catch (e) {
      // the user cancelled the download; don't treat that as this source
      // failing and go hammer the next one
      if (e instanceof Error && e.name === 'AbortError') throw e;
      log.warning(`Failed to download the AppMap Java agent from ${url}: ${e}`);
      failures.push(`${url}: ${String(e)}`);
    }
  }

  const detail = failures.length
    ? failures.join('; ')
    : `no download source produced a URL for version ${version}`;
  const message = `Failed to download the AppMap Java agent: ${detail}`;
  vscode.window.showErrorMessage(message);
  throw new Error(message);
}

// The Java agent is still on the legacy multi-source resolution chain
// (Maven → GitHub releases → bundled static fallback). Replace with a manifest
// fetch once the Java release pipeline publishes one; see FOLLOWUPS.md.
export const JavaAgentDownloader = async () => {
  const version = await resolveVersion([
    new MavenVersionResolver('com.appland', 'appmap-agent'),
    new GitHubReleaseResolver('getappmap/appmap-java'),
    new StaticVersionResolver('appmap-java.jar'),
  ]);
  if (!version) throw new Error(`Error resolving AppMap Java agent version`);

  const binaryPath = join(cacheDir(), `appmap-${version}.jar`);
  const symlinkPath = join(AppMapJavaAgentDir(), 'appmap.jar');

  const assets = await listAssets(AssetIdentifier.JavaAgent);
  if (assets.length > 0) {
    const v = versionFromPath(assets[0]);
    const semv = v && semverClean(v, { loose: true });
    if (semv && semverCompareBuild(semv, version) >= 0) {
      const cached = assets[0];
      if (await targetMissing(symlinkPath)) {
        log.info(`Linking ${symlinkPath} to cached version ${cached}`);
        await updateSymlink(cached, symlinkPath);
      } else {
        log.info(`Cached version ${cached} is up to date`);
      }
      return;
    }
  }

  if (await downloadRequired(binaryPath)) {
    await downloadFirstAvailable(
      [
        new BundledFileDownloadUrlResolver('appmap-java.jar', (v) => `appmap-${v}.jar`),
        new MavenDownloadUrlResolver('com.appland', 'appmap-agent'),
        new GitHubDownloadUrlResolver(
          'getappmap/appmap-java',
          (version) => `v${version}/appmap-${version}.jar`
        ),
      ],
      version,
      binaryPath
    );
    await markExecutable(binaryPath);
    await updateSymlink(binaryPath, symlinkPath);
  } else if (await targetMissing(symlinkPath)) {
    await updateSymlink(binaryPath, symlinkPath);
  }
};
