import { join } from 'node:path';

import { AbortError } from 'node-fetch';
import * as vscode from 'vscode';

import ExtensionSettings from '../configuration/extensionSettings';

import {
  AppMapCliDownloader,
  BundledFileDownloadUrlResolver,
  JavaAgentDownloader,
  ScannerDownloader,
  binaryName,
  markExecutable,
  updateSymlink,
  AssetIdentifier,
  listAssets,
  versionFromPath,
} from '.';
import { homedir } from 'os';
import { mkdir } from 'fs/promises';
import LockfileSynchronizer from '../lib/lockfileSynchronizer';

import * as log from './log';

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

  // make sure all present assets have their symlinks in place
  public static async ensureLinks(): Promise<boolean> {
    const appmapDir = join(homedir(), '.appmap');
    const dirs = [join(appmapDir, 'bin'), join(appmapDir, 'lib', 'java')];
    await Promise.all(dirs.map((dir) => mkdir(dir, { recursive: true })));

    let allPresent = true;
    for (const assetId of AssetService.downloaders.keys()) {
      const assetPath = AssetService.getAssetPath(assetId);
      const assets = await listAssets(assetId);
      if (assets.length === 0) {
        allPresent = false;
        continue;
      }

      const target = assets[0];
      if (assetId !== AssetIdentifier.JavaAgent) await markExecutable(target);
      try {
        await updateSymlink(target, assetPath);
      } catch (e) {
        log.error(`Failed to restore symlink or copy for ${assetPath}: ${e}`);
        allPresent = false;
      }
    }
    return allPresent;
  }

  public static async getMostRecentVersion(assetId: AssetIdentifier): Promise<string | undefined> {
    const assets = await listAssets(assetId);
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

  // ensure all assets are present and have their symlinks in place
  // if all are present, returns immediately but updates in the background
  // if any are missing, waits for the update to complete
  public static async ensureAssets(): Promise<void> {
    const allPresent = await this.ensureLinks();
    if (!allPresent && !ExtensionSettings.autoUpdateTools) {
      throw new Error(
        'Automatic tool updates are disabled and some AppMap tools are missing. You may need to enable automatic updates or install the tools manually.'
      );
    }

    const update = this.updateAll();
    if (allPresent) return;
    else return update;
  }

  public static async updateAll(throwOnError = false): Promise<void> {
    if (!ExtensionSettings.autoUpdateTools) {
      log.info('Automatic tool updates are disabled, skipping update.');
      return;
    }

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
