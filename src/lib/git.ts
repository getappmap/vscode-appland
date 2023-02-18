import assert from 'node:assert';
import { isNativeError } from 'node:util/types';
import * as vscode from 'vscode';
import { API as GitAPI, GitExtension } from '../../types/vscode.git';

function getExtension(): GitAPI | undefined {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!extension?.isActive) return;
  if (!extension.exports.enabled) return;
  return extension.exports.getAPI(1);
}

// Utility type. This is just so the type system can
// verify we're not leaking unsantitzed uris anywhere.
class SanitizedUri {
  uri: vscode.Uri;

  constructor(uri: string) {
    this.uri = parseGitUri(uri);
    if (this.uri.authority?.includes('@'))
      this.uri = this.uri.with({ authority: this.uri.authority.replace(/^.*@/, '') });
  }

  toString() {
    return this.uri.toString();
  }
}

// parses a git uri, including special scp uris
function parseGitUri(uri: string): vscode.Uri {
  try {
    return vscode.Uri.parse(uri);
  } catch (err) {
    assert(isNativeError(err));
    if (!err.message.includes('UriError')) throw err;
    return vscode.Uri.parse('ssh://' + uri.replace(':', '/'));
  }
}

function findAndSanitizeRepository(projectUri: vscode.Uri): SanitizedUri | undefined {
  const repo = getExtension()?.getRepository(projectUri);
  if (!repo) return;
  const remotes = repo.state.remotes;
  if (remotes.length === 0) return;

  const origin = remotes.find(({ name }) => name === 'origin');
  if (origin?.fetchUrl) return new SanitizedUri(origin.fetchUrl);

  const first = remotes.find(({ fetchUrl }) => !!fetchUrl);
  if (!first?.fetchUrl) return;

  return new SanitizedUri(first.fetchUrl);
}

export function findRepository(projectUri: vscode.Uri) {
  return findAndSanitizeRepository(projectUri)?.toString();
}
