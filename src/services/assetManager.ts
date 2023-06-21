import * as vscode from 'vscode';

import { copyFileSync, mkdirSync, statSync, symlinkSync, unlinkSync } from 'fs';
import os from 'os';
import path from 'path';

import GithubRelease, { GithubReleaseAsset } from '../lib/githubRelease';
import { touch } from '../lib/touch';
import { DEBUG_EXCEPTION, DOWNLOADED_JAVA_JAR, Telemetry } from '../telemetry';
import { fileExists } from '../util';
import ErrorCode from '../telemetry/definitions/errorCodes';

export default class AssetManager {
  private static FIVE_MINUTES_IN_MILLISECONDS = 5 * 60 * 1000;
  private static appmapJavaRelease = new GithubRelease('getappmap', 'appmap-java');
  private static outputChannel = vscode.window.createOutputChannel('AppMap: Assets');
  public static logLines: string[] = [];

  private static get javaAgentDir(): string {
    return path.join(os.homedir(), '.appmap', 'lib', 'java');
  }

  private static log(line: string) {
    this.logLines.push(line);
    this.outputChannel.appendLine(line);
  }

  private static async getLatestJavaJarInfo(): Promise<GithubReleaseAsset> {
    const assets = await this.appmapJavaRelease.getLatestAssets();
    const asset = assets.find((a) => a.content_type === 'application/java-archive');
    if (!asset) throw Error('Could not retrieve latest Java agent release');
    return asset;
  }

  private static async createLockfile(assetName: string): Promise<string | undefined> {
    const lockfilePath = path.join(this.javaAgentDir, assetName + '.downloading');
    if (await fileExists(lockfilePath)) {
      const lockfileCreationTime = statSync(lockfilePath).mtime;
      const timeSinceCreation = new Date().getTime() - lockfileCreationTime.getTime();
      if (timeSinceCreation < AssetManager.FIVE_MINUTES_IN_MILLISECONDS) return;
    }
    await touch(lockfilePath);
    return lockfilePath;
  }

  private static updateLatestFile(
    assetName: string,
    assetPath: string,
    symlinkPath: string
  ): boolean {
    let symlinkCreated = true;
    try {
      symlinkSync(assetName, symlinkPath, 'file');
    } catch (e) {
      copyFileSync(assetPath, symlinkPath);
      symlinkCreated = false;
    }
    return symlinkCreated;
  }

  public static async getLatestJavaJar(): Promise<void> {
    try {
      const asset = await this.getLatestJavaJarInfo();
      if (!(await fileExists(this.javaAgentDir))) mkdirSync(this.javaAgentDir, { recursive: true });
      const assetPath = path.join(this.javaAgentDir, asset.name);
      if (await fileExists(assetPath)) return;

      const lockfilePath = await this.createLockfile(asset.name);
      if (!lockfilePath) {
        this.log(`Did not download ${asset.name} because lockfile already exists.`);
        return;
      }

      this.log(`Downloading AppMap Java agent ${asset.name}`);
      await GithubRelease.downloadAsset(asset, assetPath);

      const symlinkPath = path.join(this.javaAgentDir, 'appmap.jar');
      try {
        unlinkSync(symlinkPath);
      } catch (e) {
        // if the symlink that we're trying to remove does not exist, don't do anything
      }

      const symlinkCreated = this.updateLatestFile(asset.name, assetPath, symlinkPath);
      unlinkSync(lockfilePath);

      this.log(`Finished downloading AppMap Java agent to ${assetPath}`);
      Telemetry.sendEvent(DOWNLOADED_JAVA_JAR, { symlinkCreated, version: asset.name });
    } catch (e) {
      const err = e as Error;
      this.log(err.message);

      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: err,
        errorCode: ErrorCode.AssetAcquisitionFailure,
        log: this.logLines.join('\n'),
      });
    }
  }

  public static async register(): Promise<void> {
    await this.getLatestJavaJar();
  }
}
