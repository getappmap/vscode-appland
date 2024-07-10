import { Uri } from 'vscode';

export function isTelemetryEnabled() {
  return false;
}

export async function asExternalUri(uri: Uri) {
  return uri;
}
