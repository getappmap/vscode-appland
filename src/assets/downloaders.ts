import { join } from 'node:path';
import { Uri } from 'vscode';
import semverClean from 'semver/functions/clean';
import semverCompareBuild from 'semver/functions/compare-build';

import * as log from './log';
import { AssetIdentifier, binaryName, getPlatformIdentifier, versionFromPath } from './types';
import {
  GitHubReleaseResolver,
  NpmVersionResolver,
  StaticVersionResolver,
  GitHubDownloadUrlResolver,
} from './resolvers';
import {
  AppMapBinDir,
  cacheDir,
  download,
  downloadRequired,
  listAssets,
  markExecutable,
  targetMissing,
  updateSymlink,
} from './helpers';
import { VersionResolver } from './versionResolver';

async function resolveVersion(resolvers: VersionResolver[]) {
  for (const resolver of resolvers) {
    const result = await resolver.getLatestVersion();
    if (result) return result;
  }
}

async function downloadCliAsset(assetId: AssetIdentifier.AppMapCli | AssetIdentifier.ScannerCli) {
  const name = assetId === AssetIdentifier.AppMapCli ? 'appmap' : 'scanner';

  const pkgName = '@appland/' + name;
  const resolvers: VersionResolver[] = [
    new GitHubReleaseResolver('getappmap/appmap-js', `${pkgName}-v`),
    new NpmVersionResolver(pkgName),
    new StaticVersionResolver(name),
  ];

  const version = await resolveVersion(resolvers);
  if (!version) throw new Error(`Error resolving ${name} version`);

  const platformId = getPlatformIdentifier();
  const binaryVerName = binaryName(`${name}-${platformId}-${version}`);

  const binaryPath = join(cacheDir(), binaryVerName);
  const symlinkPath = join(AppMapBinDir(), binaryName(name));

  // check if we already have the same or newer version in the cache
  const assets = await listAssets(assetId);
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

export const AppMapCliDownloader = () => downloadCliAsset(AssetIdentifier.AppMapCli);
export const ScannerDownloader = () => downloadCliAsset(AssetIdentifier.ScannerCli);
