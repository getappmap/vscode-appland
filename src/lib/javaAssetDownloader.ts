import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import GithubRelease, { GithubReleaseAsset } from './githubRelease';
import { fileExists } from '../util';

export interface ProgressReporter {
  aquiredLock(): void;

  waitingOnLock(): void;

  waitingSuccess(): void;

  upToDate(): void;

  identifiedAsset(name: string): void;

  downloading(name: string): void;

  downloaded(assetPath: string, symlinkCreated: boolean, version: string): unknown;

  symlinked(assetName: string, symlinkPath: string): void;

  unableToSymlink(assetName: string, symlinkPath: string): void;

  error(err: Error): void;
}

export default class JavaAssetDownloader {
  private static appmapJavaRelease = new GithubRelease('getappmap', 'appmap-java');
  public static readonly JavaAgentDir = path.join(os.homedir(), '.appmap', 'lib', 'java');
  public static readonly JavaAgentPath = path.join(JavaAssetDownloader.JavaAgentDir, 'appmap.jar');

  constructor(public progressReporter: ProgressReporter) {}

  private static async getLatestJavaJarInfo(): Promise<GithubReleaseAsset> {
    const assets = await this.appmapJavaRelease.getLatestAssets();
    const asset = assets.find((a) => a.content_type === 'application/java-archive');
    if (!asset) throw Error('Could not retrieve latest Java agent release');
    return asset;
  }

  private async updateLatestFile(
    assetName: string,
    assetPath: string,
    symlinkPath: string
  ): Promise<boolean> {
    let symlinkCreated = true;
    try {
      await fs.symlink(assetName, symlinkPath, 'file');
      this.progressReporter.symlinked(assetName, symlinkPath);
    } catch (e) {
      await fs.copyFile(assetPath, symlinkPath);
      this.progressReporter.unableToSymlink(assetName, symlinkPath);
      symlinkCreated = false;
    }
    return symlinkCreated;
  }

  public async installLatestJavaJar(): Promise<void> {
    await fs.mkdir(JavaAssetDownloader.JavaAgentDir, { recursive: true });

    const asset = await JavaAssetDownloader.getLatestJavaJarInfo();
    this.progressReporter.identifiedAsset(asset.name);

    const assetPath = path.join(JavaAssetDownloader.JavaAgentDir, asset.name);
    if (await fileExists(assetPath)) {
      this.progressReporter.upToDate();
      return;
    }

    this.progressReporter.downloading(asset.name);
    await GithubRelease.downloadAsset(asset, assetPath);

    const symlinkPath = JavaAssetDownloader.JavaAgentPath;
    try {
      await fs.unlink(symlinkPath);
    } catch (e) {
      // if the symlink that we're trying to remove does not exist, don't do anything
    }

    const symlinkCreated = await this.updateLatestFile(asset.name, assetPath, symlinkPath);
    this.progressReporter.downloaded(assetPath, symlinkCreated, asset.name);
  }
}
