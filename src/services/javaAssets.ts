import * as vscode from 'vscode';
import os from 'os';

import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import JavaAssetDownloader, { ProgressReporter } from '../lib/javaAssetDownloader';
import LockfileSynchronizer from '../lib/lockfileSynchronizer';
import { fileExists } from '../util';
import { promises as fs } from 'fs';

export enum AssetStatus {
  Pending,
  Updating,
  UpToDate,
  Error,
}

class ProgressReporterImpl implements ProgressReporter {
  logLines: string[] = [];

  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  aquiredLock(): void {
    this.log(`Checking for updates...`);
  }

  waitingOnLock(): void {
    this.log('Waiting for updates...');
  }

  waitingSuccess(): void {
    this.log('The AppMap agent for Java is up to date.');
  }

  upToDate(): void {
    this.log('The AppMap agent for Java is up to date.');
  }

  identifiedAsset(assetName: string): void {
    this.log(`The latest release of the AppMap agent for Java is ${assetName}`);
  }

  unableToSymlink(assetName: string, symlinkPath: string) {
    this.log(
      `Unable to symlink ${assetName} to ${symlinkPath}. Maybe ${os.type()} ${os.platform()} doesn't support symlinks?`
    );
  }

  downloading(name: string): void {
    this.log(`Downloading AppMap agent for Java ${name}`);
  }

  downloaded(assetPath: string, _symlinkCreated: boolean, _version: string) {
    this.log(`Finished downloading AppMap Java agent to ${assetPath}`);
  }

  symlinked(assetName: string, symlinkPath: string): void {
    this.log(`Symlinked ${assetName} to ${symlinkPath}`);
  }

  error(err: Error, emitTelemetry?: boolean): void {
    if (err.stack) {
      this.log(err.stack);
    } else {
      this.log(`Update failed: ${err.message}`);
    }

    if (emitTelemetry) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: err,
        errorCode: ErrorCode.AssetAcquisitionFailure,
        log: this.logLines.join('\n'),
      });
    }
  }

  log(line: string) {
    this.logLines.push(line);
    if (this.outputChannel) this.outputChannel.appendLine(line);
  }
}

export default class JavaAssets {
  private static _status = AssetStatus.Pending;
  private static _onStatusChanged = new vscode.EventEmitter<AssetStatus>();
  private static outputChannel = vscode.window.createOutputChannel('AppMap: Assets');
  public static onStatusChanged: vscode.Event<AssetStatus> = this._onStatusChanged.event;

  static get status() {
    return this._status;
  }

  static set status(status: AssetStatus) {
    if (status === this._status) return;

    this._status = status;
    this._onStatusChanged.fire(status);
  }

  static async assetsExist(): Promise<boolean> {
    return fileExists(JavaAssetDownloader.JavaAgentPath);
  }

  static async installLatestJavaJar(raiseOnError: boolean) {
    await fs.mkdir(JavaAssetDownloader.JavaAgentDir, { recursive: true });

    let holdingLock = false;
    const progressReporter = new ProgressReporterImpl(this.outputChannel);
    const sync = new LockfileSynchronizer(JavaAssetDownloader.JavaAgentDir);

    return new Promise<void>((resolve, reject) => {
      sync
        .on('wait', () => {
          this.status = AssetStatus.Updating;
          progressReporter.waitingOnLock();
        })
        .on('error', (e) => {
          this.status = AssetStatus.Error;
          progressReporter.error(e, holdingLock);
          raiseOnError ? reject(e) : resolve();
        })
        .on('success', () => {
          if (!holdingLock) progressReporter.waitingSuccess();
          this.status = AssetStatus.UpToDate;
          resolve();
        })
        .execute(async () => {
          holdingLock = true;
          progressReporter.aquiredLock();
          this.status = AssetStatus.Updating;
          const assetDownloader = new JavaAssetDownloader(progressReporter);
          await assetDownloader.installLatestJavaJar();
        });
    });
  }

  static showOutput() {
    this.outputChannel.show();
  }

  static dispose() {
    this._onStatusChanged.dispose();
  }
}
