import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

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

// Order is important while checking with fileName.startsWith
const binaryPrefixes = ['appmap-agent-', 'appmap-', 'scanner-'];
const binarySuffixes = ['.exe', '.jar'];

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
      const versions: string[] = semverSort(ents.map((ent) => ent.split(/-v?/)[1]).filter(Boolean));
      return versions.pop();
    } catch (e) {
      log.error(`Failed to retrieve most recent version of ${basename}: ${e}`);
      return undefined;
    }
  }

  public static getAppmapDir() {
    return join(homedir(), '.appmap');
  }

  public static getAssetPath(assetId: AssetIdentifier): string {
    // This could be a property on each AssetDownloader
    switch (assetId) {
      case AssetIdentifier.AppMapCli:
        return join(this.getAppmapDir(), 'bin', binaryName('appmap'));
      case AssetIdentifier.ScannerCli:
        return join(this.getAppmapDir(), 'bin', binaryName('scanner'));
      case AssetIdentifier.JavaAgent:
        return join(this.getAppmapDir(), 'lib', 'java', 'appmap.jar');
      default:
        throw new Error(`Invalid asset ID ${assetId}`);
    }
  }

  public static async updateAll(throwOnError = false): Promise<void> {
    const appmapDir = this.getAppmapDir();
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
          await this.cleanUpOldBinaries();
          await initialDownloadCompleted();
        });
    });
  }

  public static async updateOne(assetId: AssetIdentifier): Promise<void> {
    const appmapDir = this.getAppmapDir();
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

          const result = await asset();
          await this.cleanUpOldBinaries();
          return result;
        });
    });
  }

  static async cleanUpOldBinaries() {
    try {
      const libDir = join(this.getAppmapDir(), 'lib');
      const binDir = join(this.getAppmapDir(), 'bin');

      const symlinks = (await fs.promises.readdir(binDir, { withFileTypes: true }))
        .filter((f) => f.isSymbolicLink())
        .map((f) => join(binDir, f.name));
      const symlinkTargets = new Set<string>();
      for (const symlink of symlinks) {
        symlinkTargets.add(path.resolve(await fs.promises.readlink(symlink)));
      }

      await this.cleanUpOldBinariesFromDir(join(libDir, 'appmap'), symlinkTargets);
      await this.cleanUpOldBinariesFromDir(join(libDir, 'java'), symlinkTargets);
      await this.cleanUpOldBinariesFromDir(join(libDir, 'scanner'), symlinkTargets);
    } catch (error) {
      log.error(`Failed to clean up old binaries: ${error}`);
    }
  }

  private static async cleanUpOldBinariesFromDir(dir: string, symlinkTargets: Set<string>) {
    const files = await fs.promises.readdir(dir);
    const fileGroups: { [key: string]: { name: string; version: string }[] } = {};

    const hasSymlink = (binaryPath: string) => {
      const resolvedBinaryPath = path.resolve(binaryPath);
      return symlinkTargets.has(resolvedBinaryPath);
    };

    files.forEach((file) => {
      const version = this.extractVersion(file);
      if (version && semver.valid(version)) {
        const groupName = file.replace(version, '');
        if (!fileGroups[groupName]) {
          fileGroups[groupName] = [];
        }
        fileGroups[groupName].push({ name: file, version });
      }
    });

    for (const groupName in fileGroups) {
      // Sort in descending order of versions
      const binaries = fileGroups[groupName].sort((a, b) => semver.compare(b.version, a.version));

      // Keep the latest version, delete the rest
      for (let i = 1; i < binaries.length; i++) {
        const binaryPath = path.join(dir, binaries[i].name);

        // Check if the binary is the target of any symlink
        if (hasSymlink(binaryPath)) {
          log.warning(`Skipping deletion of ${binaries[i].name} as it's targeted by a symlink.`);
          continue;
        }

        await fs.promises.unlink(binaryPath);
        log.info(`Deleted old binary: ${binaries[i].name}`);
      }
    }
  }

  public static extractVersion(fileName: string): string | null {
    // We have to remove known prefixes and suffixes, and immediate
    // 'v' after the prefix, otherwise version part would be ambiguous.
    const prefix = binaryPrefixes.find((p) => fileName.toLowerCase().startsWith(p));
    const suffix = binarySuffixes.find((p) => fileName.toLowerCase().endsWith(p));
    let version = fileName;
    if (prefix != undefined) version = version.substring(prefix.length);
    if (suffix != undefined) version = version.substring(0, version.length - suffix.length);
    if (version.toLowerCase().startsWith('v')) version = version.substring(1);

    // https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
    // https://regex101.com/r/vkijKf/1/
    const semverRegexp =
      /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/gm;
    const versionMatch = version.match(semverRegexp);
    return versionMatch ? version : null;
  }
}
