import { Readable } from 'stream';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';
import DownloadUrlResolver from './downloadUrlResolver';
import { VersionResolver } from './versionResolver';
import AssetService from './assetService';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { Uri } from 'vscode';

export type DownloadHooks = {
  shouldDownload?: (version: string) => boolean | Promise<boolean>;
  skippedDownload?: (version: string) => void | Promise<void>;
  beforeDownload?: (version: string) => void | Promise<void>;
  download(stream: Readable, version: string): void | Promise<void>;
  afterDownload?: (version: string) => void | Promise<void>;
};

export default class AssetDownloader {
  constructor(
    private readonly assetName: string,
    private readonly versionResolvers: VersionResolver[],
    private readonly downloadUrlResolvers: DownloadUrlResolver[],
    private readonly downloadHooks: DownloadHooks
  ) {}

  private async getLatestVersion(): Promise<string | undefined> {
    for (const versionResolver of this.versionResolvers) {
      const version = await versionResolver.getLatestVersion();
      if (version) {
        return version;
      }
    }
  }

  public async download() {
    const version = await this.getLatestVersion();
    if (!version) {
      throw new Error(
        `Failed to retrieve the latest version of ${this.assetName}. No updates will be applied.`
      );
    }

    const versionString = version.startsWith('v') ? version : `v${version}`;
    const shouldDownload = await this.downloadHooks.shouldDownload?.(version);
    if (!shouldDownload) {
      AssetService.logInfo(`${this.assetName} is up to date (${versionString}).`);

      // If this throws it's not a big deal. We weren't going to download anyway.
      // The asset log will indicate the error.
      await this.downloadHooks.skippedDownload?.(version);
      return;
    }

    AssetService.logInfo(`New version of ${this.assetName} available: ${versionString}`);

    await this.downloadHooks.beforeDownload?.(version);

    let downloadSuccessful = false;
    for (const downloadUrlResolver of this.downloadUrlResolvers) {
      const downloadUrl = await downloadUrlResolver.getDownloadUrl(version);
      if (!downloadUrl) {
        continue;
      }

      try {
        let stream: Readable;
        if (downloadUrl.startsWith('http')) {
          AssetService.logInfo(
            `Downloading ${this.assetName} ${versionString} from ${downloadUrl}`
          );
          const res = await fetch(downloadUrl);
          if (!res.ok) {
            throw new Error(
              `Got unexpected response status ${res.status} while downloading ${this.assetName} from ${downloadUrl}`
            );
          }

          if (!res.body) {
            throw new Error(
              `Response body is empty while downloading ${this.assetName} via ${downloadUrl}`
            );
          }

          stream = Readable.from(res.body);
        } else if (downloadUrl.startsWith('file://')) {
          const uri = Uri.parse(downloadUrl);
          AssetService.logInfo(`Updating ${this.assetName} ${versionString} from ${uri}`);
          stream = createReadStream(uri.fsPath);
        } else {
          throw new Error(`Unsupported download URL: ${downloadUrl}`);
        }

        await this.downloadHooks.download(stream, version);
        await this.downloadHooks.afterDownload?.(version);
        AssetService.logInfo(`Update of ${this.assetName} complete.`);
        downloadSuccessful = true;
        break;
      } catch (e) {
        if (e instanceof Error) {
          if ('cause' in e) {
            AssetService.logWarning(`Failed to download from ${downloadUrl}: ${e.message}`);
            AssetService.logWarning(String(e['cause']));
          } else {
            AssetService.logWarning(String(e.message));
          }
        }
      }
    }

    if (!downloadSuccessful) {
      const err = new Error(`Failed to download ${this.assetName}`);
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: err,
        errorCode: ErrorCode.AssetAcquisitionFailure,
      });
      throw err;
    }
  }
}
