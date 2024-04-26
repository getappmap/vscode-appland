import assert from 'node:assert';
import { open, rename } from 'node:fs/promises';
import { basename } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import fetch, { AbortError } from 'node-fetch'; // we could use native but nock doesn't support it
import vscode, { Uri } from 'vscode';

import * as log from './log';

async function downloadHttp(
  url: Uri,
  destinationPath: string,
  progress: (incrementOrMessage: number | string) => void,
  signal: AbortSignal
): Promise<void> {
  assert(url.scheme.startsWith('http'));

  const response = await fetch(url.toString(), { signal });

  if (!(response.ok && response.body))
    throw new Error(`Failed to download file: ${response.status}`);

  const contentLength = response.headers.get('content-length');
  const totalSize = contentLength && parseInt(contentLength, 10);
  let downloadedSize = 0;

  const file = await open(destinationPath, 'w');

  try {
    for await (const chunk of response.body) {
      await file.write(Buffer.from(chunk));
      downloadedSize += chunk.length;
      progress(totalSize ? (chunk.length / totalSize) * 100 : `${downloadedSize} total bytes`);
    }
  } finally {
    await file.close();
  }
}

export default async function downloadHttpRetry(
  uri: Uri,
  destinationPath: string,
  download = downloadHttp
) {
  log.info(`Downloading ${uri} to ${destinationPath}...`);
  const partPath = destinationPath + '.part';
  const baseName = basename(destinationPath);
  for (let i = 0; i < downloadHttpRetry.maxTries; i++) {
    try {
      if (i > 0) {
        // exponential backoff
        const timeout = downloadHttpRetry.retryDelay ** i;
        log.info(`Backing off for ${timeout} seconds.`);
        await setTimeout(timeout * 1000);
      }

      await vscode.window.withProgress(
        {
          title: `Downloading ${baseName}...`,
          location: vscode.ProgressLocation.Notification,
          cancellable: true,
        },
        (progress, token) => {
          const controller = new AbortController();
          token.onCancellationRequested(() => controller.abort());
          return download(
            uri,
            partPath,
            (incrementOrMessage) =>
              progress.report(
                typeof incrementOrMessage === 'string'
                  ? { message: incrementOrMessage }
                  : { increment: incrementOrMessage }
              ),
            controller.signal
          );
        }
      );

      await rename(partPath, destinationPath);
      log.info(`Downloaded ${uri} to ${destinationPath}`);
      return;
    } catch (error) {
      if (error instanceof AbortError) throw error;
      if (i === downloadHttpRetry.maxTries - 1) {
        vscode.window.showErrorMessage(`Error downloading ${uri}: ${String(error)}`);
        throw error;
      } else {
        log.warning(`Error downloading ${uri}: ${String(error)}`);
        vscode.window.showWarningMessage(`Error downloading ${uri}: ${String(error)}`);
      }
    }
  }
}

downloadHttpRetry.maxTries = 3;
downloadHttpRetry.retryDelay = 5;
