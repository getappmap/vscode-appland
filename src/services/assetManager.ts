import * as vscode from 'vscode';
import os from 'os';

import { DEBUG_EXCEPTION, DOWNLOADED_JAVA_JAR, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import AssetManager, { ProgressReporter } from '../lib/assetManager';

class ProgressReporterImpl implements ProgressReporter {
  logLines: string[] = [];
  outputChannel = vscode.window.createOutputChannel('AppMap: Assets');

  identifiedAsset(assetName: string): void {
    this.log(`Identified asset to download: ${assetName}`);
  }

  unableToSymlink(assetName: string, symlinkPath: string) {
    this.log(
      `Unable to symlink ${assetName} to ${symlinkPath}. Maybe ${os.type()} ${os.platform()} doesn't support symlinks?`
    );
  }

  downloadLocked(assetName: string) {
    this.log(`Will not download ${assetName} because a recent lockfile already exists.`);
  }

  downloading(name: string): void {
    this.log(`Downloading AppMap Java agent ${name}`);
  }

  downloaded(assetPath: string, symlinkCreated: boolean, version: string) {
    this.log(`Finished downloading AppMap Java agent to ${assetPath}`);
    Telemetry.sendEvent(DOWNLOADED_JAVA_JAR, { symlinkCreated, version });
  }

  symlinked(assetName: string, symlinkPath: string): void {
    this.log(`Symlinked ${assetName} to ${symlinkPath}`);
  }

  error(err: Error): void {
    this.log(err.message);

    Telemetry.sendEvent(DEBUG_EXCEPTION, {
      exception: err,
      errorCode: ErrorCode.AssetAcquisitionFailure,
      log: this.logLines.join('\n'),
    });
  }

  protected log(line: string) {
    this.logLines.push(line);
    if (this.outputChannel) this.outputChannel.appendLine(line);
  }
}

export default async function installLatestJavaJar(raiseOnError: boolean) {
  const assetManager = new AssetManager(raiseOnError, new ProgressReporterImpl());
  assetManager.installLatestJavaJar();
}
