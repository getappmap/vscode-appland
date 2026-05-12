import { join } from 'node:path';
import { lstat, readlink, unlink } from 'node:fs/promises';
import { Uri } from 'vscode';

import * as log from './log';
import ExtensionSettings from '../configuration/extensionSettings';
import { AssetIdentifier, binaryName, getPlatformIdentifier, versionFromPath } from './types';
import { ManifestManager, verifyDigest } from './manifest';
import {
  AppMapBinDir,
  cacheDir,
  download,
  listAssets,
  markExecutable,
  updateSymlink,
} from './helpers';

// Whether the entry at `path` is a managed symlink that already points at
// `target`. Returns true also for regular files: we can't tell whether they
// represent the right version, but treating them as "leave alone" preserves
// user overrides and avoids re-copying on every steady-state run on Windows
// (where `updateSymlink` falls back to `copyFile`). The downside is that a
// downgrade to a version already in the cache won't refresh a copy-fallback
// install — acceptable until we ship a Windows-specific freshness check.
async function symlinkPointsTo(path: string, target: string): Promise<boolean> {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      return (await readlink(path)) === target;
    }
    return true;
  } catch {
    return false;
  }
}

async function downloadCliAsset(assetId: AssetIdentifier.AppMapCli | AssetIdentifier.ScannerCli) {
  const name = assetId === AssetIdentifier.AppMapCli ? 'appmap' : 'scanner';
  const manifestUrl =
    assetId === AssetIdentifier.AppMapCli
      ? ExtensionSettings.appmapManifestUrl
      : ExtensionSettings.scannerManifestUrl;

  const manifest = await ManifestManager.fetch(manifestUrl);
  if (!manifest) throw new Error(`Failed to fetch ${name} manifest from ${manifestUrl}`);

  const { version } = manifest;
  const platformId = getPlatformIdentifier();
  const binaryVerName = binaryName(`${name}-${platformId}-${version}`);

  const binaryPath = join(cacheDir(), binaryVerName);
  const symlinkPath = join(AppMapBinDir(), binaryName(name));

  // The manifest is authoritative: use a cached binary only if its version
  // matches exactly. This makes pinning to an older manifest version work,
  // even when a newer binary is already on disk.
  const cached = (await listAssets(assetId)).find((p) => versionFromPath(p) === version);
  if (cached) {
    if (await symlinkPointsTo(symlinkPath, cached)) {
      log.info(`Cached version ${cached} is up to date`);
    } else {
      log.info(`Linking ${symlinkPath} to cached version ${cached}`);
      await updateSymlink(cached, symlinkPath);
    }
    return;
  }

  const source = manifest.getAsset();
  if (!source) throw new Error(`No ${name} asset for ${platformId} in manifest at ${manifestUrl}`);

  await download(Uri.parse(source.url), binaryPath);

  if (source.digest) {
    const ok = await verifyDigest(binaryPath, source.digest);
    if (!ok) {
      try {
        await unlink(binaryPath);
      } catch (e) {
        log.warning(
          `Failed to remove invalid download for ${name} version ${version} at ${binaryPath}: ${e}`
        );
      }
      throw new Error(`Digest verification failed for ${name} version ${version}`);
    }
    log.info(`Verified digest for ${name} version ${version}`);
  }

  await markExecutable(binaryPath);
  await updateSymlink(binaryPath, symlinkPath);
}

export const AppMapCliDownloader = () => downloadCliAsset(AssetIdentifier.AppMapCli);
export const ScannerDownloader = () => downloadCliAsset(AssetIdentifier.ScannerCli);
