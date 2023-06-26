import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';

import GithubRelease, { GithubReleaseAsset } from '../lib/githubRelease';

export interface ProgressReporter {
  identifiedAsset(name: string): void;

  downloadLocked(name: string): void;

  downloading(name: string): void;

  downloaded(assetPath: string, symlinkCreated: boolean, version: string): unknown;

  symlinked(assetName: string, symlinkPath: string): void;

  unableToSymlink(assetName: string, symlinkPath: string): void;

  error(err: Error): void;
}

export default class AssetManager {
  private static FIVE_MINUTES_IN_MILLISECONDS = 5 * 60 * 1000;
  private static appmapJavaRelease = new GithubRelease('getappmap', 'appmap-java');
  public static logLines: string[] = [];

  javaAgentDir: string;

  constructor(public raiseOnError: boolean, public progressReporter: ProgressReporter) {
    this.javaAgentDir = path.join(os.homedir(), '.appmap', 'lib', 'java');
  }

  private static async getLatestJavaJarInfo(): Promise<GithubReleaseAsset> {
    const assets = await this.appmapJavaRelease.getLatestAssets();
    const asset = assets.find((a) => a.content_type === 'application/java-archive');
    if (!asset) throw Error('Could not retrieve latest Java agent release');
    return asset;
  }

  // Note that this method is synchronous, to avoid possible race conditions with the
  // file update locking process.
  //
  // Returns the lockfile path, or undefined if the asset download is already locked.
  private acquireDownloadLock(assetName: string): string | undefined {
    const lockfilePath = path.join(this.javaAgentDir, assetName + '.downloading');
    if (existsSync(lockfilePath)) {
      const lockfileCreationTime = statSync(lockfilePath).mtime;
      const timeSinceCreation = new Date().getTime() - lockfileCreationTime.getTime();
      if (timeSinceCreation < AssetManager.FIVE_MINUTES_IN_MILLISECONDS) return;
    }
    writeFileSync(lockfilePath, 'lockfile');
    return lockfilePath;
  }

  private updateLatestFile(assetName: string, assetPath: string, symlinkPath: string): boolean {
    let symlinkCreated = true;
    try {
      symlinkSync(assetName, symlinkPath, 'file');
      this.progressReporter.symlinked(assetName, symlinkPath);
    } catch (e) {
      copyFileSync(assetPath, symlinkPath);
      this.progressReporter.unableToSymlink(assetName, symlinkPath);
      symlinkCreated = false;
    }
    return symlinkCreated;
  }

  public async installLatestJavaJar(): Promise<void> {
    try {
      const asset = await AssetManager.getLatestJavaJarInfo();
      this.progressReporter.identifiedAsset(asset.name);

      if (!existsSync(this.javaAgentDir)) mkdirSync(this.javaAgentDir, { recursive: true });
      const assetPath = path.join(this.javaAgentDir, asset.name);
      if (existsSync(assetPath)) return;

      const lockfilePath = this.acquireDownloadLock(asset.name);
      if (!lockfilePath) {
        this.progressReporter.downloadLocked(asset.name);
        return;
      }

      this.progressReporter.downloading(asset.name);

      await GithubRelease.downloadAsset(asset, assetPath);

      const symlinkPath = path.join(this.javaAgentDir, 'appmap.jar');
      try {
        unlinkSync(symlinkPath);
      } catch (e) {
        // if the symlink that we're trying to remove does not exist, don't do anything
      }

      const symlinkCreated = this.updateLatestFile(asset.name, assetPath, symlinkPath);

      rmSync(lockfilePath);

      this.progressReporter.downloaded(assetPath, symlinkCreated, asset.name);
    } catch (e) {
      if (this.raiseOnError) throw e;

      this.progressReporter.error(e as Error);
    }
  }
}
