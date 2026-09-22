import assert from 'node:assert';
import { open, rename, unlink } from 'node:fs/promises';
import { basename } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import vscode, { Uri } from 'vscode';

import * as log from './log';

export class HttpError extends Error {
  constructor(readonly status: number, message?: string) {
    super(message ?? `Failed to download file: got status ${status}`);
    this.name = 'HttpError';
  }

  // Only three kinds of status are worth repeating: 408 and 429 explicitly
  // mean "try again", and 5xx is the server failing rather than refusing.
  // Everything else answers the same way next time -- a 4xx is a refusal (a
  // proxy blocking the host, a missing artifact, bad credentials), and a
  // success we couldn't read a body from won't grow one -- so we fail fast
  // and let the caller move on instead of sitting through the backoff.
  //
  // 429 uses the normal schedule rather than honoring Retry-After: neither
  // Maven Central nor GitHub is likely to rate-limit an occasional agent
  // download, so parsing the header isn't worth the code.
  get retryable(): boolean {
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

async function downloadHttp(
  url: Uri,
  destinationPath: string,
  progress: (incrementOrMessage: number | string) => void,
  signal: AbortSignal
): Promise<void> {
  assert(url.scheme.startsWith('http'));

  const response = await fetch(url.toString(), { signal });

  if (!response.ok) throw new HttpError(response.status);
  // A success we can't read is still a failure, but calling it "status 200"
  // in an error message helps nobody.
  if (!response.body)
    throw new HttpError(response.status, `Download failed: ${url} returned no content`);

  const contentLength = response.headers.get('content-length');
  const totalSize = contentLength && parseInt(contentLength, 10);
  let downloadedSize = 0;

  const file = await open(destinationPath, 'w');

  try {
    for await (const chunk of response.body) {
      await file.write(chunk);
      downloadedSize += chunk.length;
      progress(totalSize ? (chunk.length / totalSize) * 100 : `${downloadedSize} total bytes`);
    }
  } finally {
    await file.close();
  }
}

export interface DownloadOptions {
  // Injection point for tests.
  download?: typeof downloadHttp;
  // Report failures to the log only. Set by callers that have another source
  // to fall back to, so a refusal from one of them doesn't put an error in
  // front of the user for a download that then succeeds elsewhere. Such a
  // caller is responsible for reporting once every source has failed.
  quiet?: boolean;
}

export default async function downloadHttpRetry(
  uri: Uri,
  destinationPath: string,
  { download = downloadHttp, quiet = false }: DownloadOptions = {}
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
      if (error instanceof Error && error.name === 'AbortError') throw error;
      const fatal = error instanceof HttpError && !error.retryable;
      if (fatal || i === downloadHttpRetry.maxTries - 1) {
        if (fatal) log.info(`${uri} returned a status that won't change on retry; giving up now`);
        // Don't leave the partial file behind; a caller falling through to
        // another source would otherwise litter one per source it tried.
        await unlink(partPath).catch(() => undefined);
        if (!quiet) vscode.window.showErrorMessage(`Error downloading ${uri}: ${String(error)}`);
        throw error;
      } else {
        log.warning(`Error downloading ${uri}: ${String(error)}`);
        if (!quiet) vscode.window.showWarningMessage(`Error downloading ${uri}: ${String(error)}`);
      }
    }
  }
}

downloadHttpRetry.maxTries = 3;
downloadHttpRetry.retryDelay = 5;
