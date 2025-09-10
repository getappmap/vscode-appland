import { AbortError } from 'node-fetch';
import * as vscode from 'vscode';
import {
  AppMapCliDownloader,
  BundledFileDownloadUrlResolver,
  JavaAgentDownloader,
  ScannerDownloader,
  binaryName,
  initialDownloadCompleted,
} from '.';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readdir } from 'fs/promises';
import LockfileSynchronizer from '../lib/lockfileSynchronizer';

import * as log from './log';
import semverSort from 'semver/functions/sort';

export enum AssetIdentifier {
  AppMapCli,
  ScannerCli,
  JavaAgent,
}

export default class AssetService {
  private static _extensionDirectory: string;
  public static get extensionDirectory() {
    return this._extensionDirectory;
  }

  private static downloaders = new Map<AssetIdentifier, () => Promise<void>>([
    [AssetIdentifier.AppMapCli, AppMapCliDownloader],
    [AssetIdentifier.ScannerCli, ScannerDownloader],
    [AssetIdentifier.JavaAgent, JavaAgentDownloader],
  ]);

  public static register(context: vscode.ExtensionContext) {
    this._extensionDirectory = context.extensionPath;
    BundledFileDownloadUrlResolver.extensionDirectory = this._extensionDirectory;
    context.subscriptions.push(log.OutputChannel);
  }

  public static async getMostRecentVersion(assetId: AssetIdentifier): Promise<string | undefined> {
    const basename = {
      [AssetIdentifier.AppMapCli]: 'appmap',
      [AssetIdentifier.ScannerCli]: 'scanner',
      [AssetIdentifier.JavaAgent]: 'java',
    }[assetId];
    if (!basename) {
      throw new Error(`Invalid asset ID ${assetId}`);
    }

    const path = join(homedir(), '.appmap', 'lib', basename);
    try {
      const ents = await readdir(path);
      console.log(ents);
      const versions: string[] = semverSort(
        ents.map((ent) => ent.split(/-v?/).at(-1)).filter(Boolean) as string[]
      );
      console.log(versions);
      return versions.pop();
    } catch (e) {
      log.error(`Failed to retrieve most recent version of ${basename}: ${e}`);
      return undefined;
    }
  }

  public static getAssetPath(assetId: AssetIdentifier): string {
    // This could be a property on each AssetDownloader
    switch (assetId) {
      case AssetIdentifier.AppMapCli:
        return join(homedir(), '.appmap', 'bin', binaryName('appmap'));
      case AssetIdentifier.ScannerCli:
        return join(homedir(), '.appmap', 'bin', binaryName('scanner'));
      case AssetIdentifier.JavaAgent:
        return join(homedir(), '.appmap', 'lib', 'java', 'appmap.jar');
      default:
        throw new Error(`Invalid asset ID ${assetId}`);
    }
  }

  public static async updateAll(throwOnError = false): Promise<void> {
    const appmapDir = join(homedir(), '.appmap');
    const dirs = [join(appmapDir, 'bin'), join(appmapDir, 'lib')];
    await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));

    let holdingLock = false;
    let hasErrors = false;
    const sync = new LockfileSynchronizer(appmapDir);
    return new Promise<void>((resolve, reject) => {
      sync
        .on('wait', () => {
          log.info(`Waiting for assets to be updated by another process...`);
        })
        .on('error', (e) => {
          if (throwOnError) {
            reject(e);
          }

          hasErrors = true;
          log.error(e.stack);
        })
        .on('success', () => {
          if (!holdingLock) {
            log.info('Another process has completed the asset update.');
          } else if (hasErrors) {
            log.error('Asset update completed with errors.');
          } else {
            log.info('Asset update completed successfully.');
          }

          resolve();
        })
        .execute(async () => {
          holdingLock = true;
          for (const asset of this.downloaders.values())
            try {
              await asset();
            } catch (e) {
              sync.emit('error', e);
              if (e instanceof AbortError) return reject(e);
            }
          await initialDownloadCompleted();
        });
    });
  }

  public static async updateOne(assetId: AssetIdentifier): Promise<void> {
    const appmapDir = join(homedir(), '.appmap');
    const sync = new LockfileSynchronizer(appmapDir);
    return new Promise<void>((resolve, reject) => {
      sync
        .on('wait', () => reject(new Error('Another process is currently updating assets')))
        .on('error', reject)
        .on('success', resolve)
        .execute(async () => {
          const asset = this.downloaders.get(assetId);
          if (!asset) {
            return reject(new Error(`Invalid asset ID ${assetId}`));
          }

          return asset();
        });
    });
  }
}
