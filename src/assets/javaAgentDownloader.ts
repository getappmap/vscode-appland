import { join } from 'node:path';
import { Uri } from 'vscode';
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

async function resolveUrl(resolvers: DownloadUrlResolver[], version: string) {
  for (const resolver of resolvers) {
    const result = await resolver.getDownloadUrl(version);
    if (result) return result;
  }
}

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
