import { Uri } from 'vscode';

export function isTelemetryEnabled() {
  return false;
}

export async function asExternalUri(uri: Uri) {
  return uri;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const uriScheme = 'vscode-test';
