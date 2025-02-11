import { warn } from 'node:console';
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { isNativeError } from 'node:util/types';

import vscode from 'vscode';

import fetchGHExclusions from './fetchGHExclusions';

const exclusionPath = join(homedir(), '.appmap', 'navie', 'global-ignore');

export async function downloadContentExclusions(githubToken: string) {
  const exclusions = await fetchGHExclusions(githubToken, 'all');
  const paths = exclusions.flatMap(({ rules }) => rules.flatMap(({ paths }) => paths));
  await writeFile(exclusionPath, paths.join('\n'));
  exclusionsDownloaded = true;
}

let exclusionsDownloaded = false;

export async function ensureExclusionsDownloaded() {
  if (exclusionsDownloaded) return;
  try {
    const githubToken = await getGHToken();
    if (!githubToken) throw new Error('Failed to obtain GitHub token');
    await downloadContentExclusions(githubToken);
  } catch (e) {
    exclusionDownloadError(e);
    throw e;
  }
}

export async function tryDownloadingExclusions() {
  if (exclusionsDownloaded) return;
  const githubToken = await getGHToken(true);
  if (githubToken)
    try {
      downloadContentExclusions(githubToken);
    } catch {
      // pass, it will be retried
    }
}

export async function getGHToken(silent = false): Promise<string | undefined> {
  const provider = vscode.workspace
    .getConfiguration()
    .get('github.copilot.advanced.authProvider', 'github');
  const session = await vscode.authentication.getSession(provider, [], {
    silent,
    createIfNone: !silent,
  });
  if (session) return session.accessToken;
}

function exclusionDownloadError(error: unknown) {
  const title = 'Failed to download content exclusion policy from GitHub';
  const errorText = isNativeError(error) ? error.message : String(error);

  warn(`Failed to download content exclusions: ${errorText}`);
  if (exclusionDownloadError.wait) return;

  const showDetails = () => {
    vscode.window.showErrorMessage(title, {
      detail: `${errorText}\nPlease try again later.`,
      modal: true,
    });
  };
  if (exclusionDownloadError.wait === null) showDetails(); // first time always show the details
  else vscode.window.showErrorMessage(title, {}, 'More...').then((x) => x && showDetails());

  exclusionDownloadError.wait = true;
  setTimeout(() => (exclusionDownloadError.wait = false), 5000).unref();
}
exclusionDownloadError.wait = null as boolean | null;
