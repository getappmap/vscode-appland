import * as vscode from 'vscode';
import { AppMapCliDownloader, JavaAgentDownloader, ScannerDownloader } from '.';
import AssetDownloader from './assetDownloader';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import LockfileSynchronizer from '../lib/lockfileSynchronizer';

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

  private static OutputChannel = vscode.window.createOutputChannel('AppMap: Assets', 'log');
  private static downloaders = new Map<AssetIdentifier, AssetDownloader>([
    [AssetIdentifier.AppMapCli, AppMapCliDownloader],
    [AssetIdentifier.ScannerCli, ScannerDownloader],
    [AssetIdentifier.JavaAgent, JavaAgentDownloader],
  ]);

  public static log(message: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
    this.OutputChannel.appendLine(
      `${new Date().toLocaleString()} ${level.padEnd(5, ' ')} ${message}`
    );
  }

  public static logInfo(message: string) {
    this.log(message, 'INFO');
  }

  public static logError(message: string) {
    this.log(message, 'ERROR');
  }

  public static logWarning(message: string) {
    this.log(message, 'WARN');
  }

  public static register(context: vscode.ExtensionContext) {
    this._extensionDirectory = context.extensionPath;
    context.subscriptions.push(this.OutputChannel);
  }

  public static getAssetPath(assetId: AssetIdentifier): string {
    // This could be a property on each AssetDownloader
    switch (assetId) {
      case AssetIdentifier.AppMapCli:
        return join(homedir(), '.appmap', 'bin', 'appmap');
      case AssetIdentifier.ScannerCli:
        return join(homedir(), '.appmap', 'bin', 'scanner');
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
          this.logInfo(`Waiting for assets to be updated by another process...`);
        })
        .on('error', (e) => {
          if (throwOnError) {
            reject(e);
          }

          hasErrors = true;
          this.logError(e.stack);
        })
        .on('success', () => {
          if (!holdingLock) {
            this.logInfo('Another process has completed the asset update.');
          } else if (hasErrors) {
            this.logError('Asset update completed with errors.');
          } else {
            this.logInfo('Asset update completed successfully.');
          }

          resolve();
        })
        .execute(async () => {
          holdingLock = true;
          const assets = Array.from(this.downloaders.values());
          await Promise.all(
            assets.map((asset) => asset.download().catch((e) => sync.emit('error', e)))
          );
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

          return asset.download();
        });
    });
  }
}
