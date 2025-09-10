import { basename, join } from 'node:path';

import { AbortError } from 'node-fetch';
import semverCompareBuild from 'semver/functions/compare-build';
import * as vscode from 'vscode';
import {
  AppMapCliDownloader,
  BundledFileDownloadUrlResolver,
  JavaAgentDownloader,
  ScannerDownloader,
  binaryName,
  cacheDir,
  getPlatformIdentifier,
  initialDownloadCompleted,
} from '.';
import { homedir } from 'os';
import { mkdir, readdir } from 'fs/promises';
import LockfileSynchronizer from '../lib/lockfileSynchronizer';

import * as log from './log';

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

  public static async listAssets(assetId: AssetIdentifier): Promise<string[]> {
    const DIRS = [cacheDir(), BundledFileDownloadUrlResolver.resourcePath];
    const results: string[] = [];
    for (const dir of DIRS) {
      try {
        const ents = await readdir(dir);
        for (const ent of ents) {
          if (
            (assetId === AssetIdentifier.JavaAgent && ent.endsWith('.jar')) ||
            (assetId === AssetIdentifier.AppMapCli &&
              ent.startsWith('appmap') &&
              ent.includes(getPlatformIdentifier())) ||
            (assetId === AssetIdentifier.ScannerCli &&
              ent.startsWith('scanner') &&
              ent.includes(getPlatformIdentifier()))
          ) {
            results.push(join(dir, ent));
          }
        }
      } catch (e) {
        // ignore, directory may not exist
      }
    }

    // sort by version descending
    results.sort((a, b) => {
      const va = versionFromPath(a);
      const vb = versionFromPath(b);
      if (va && vb) return -semverCompareBuild(va, vb);
      if (va) return -1;
      if (vb) return 1;
      return 0;
    });

    return results;
  }

  public static async getMostRecentVersion(assetId: AssetIdentifier): Promise<string | undefined> {
    const assets = await this.listAssets(assetId);
    if (assets.length === 0) return undefined;
    return versionFromPath(assets[0]);
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

function versionFromPath(p: string): string | undefined {
  const base = basename(p)
    .replace(/\.exe$/, '')
    .replace(/\.jar$/, '');
  const match = base.match(/-(\d.*)$/);
  if (!match) return undefined;
  return match[1];
}
