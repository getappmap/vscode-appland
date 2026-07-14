import { Uri } from 'vscode';
import EventEmitter from './EventEmitter';

// Mirrors vscode.env.isTelemetryEnabled (a boolean property, not a function).
// eslint-disable-next-line @typescript-eslint/naming-convention
export const isTelemetryEnabled = true;

const telemetryEnabledEmitter = new EventEmitter<boolean>();
// eslint-disable-next-line @typescript-eslint/naming-convention
export const onDidChangeTelemetryEnabled = telemetryEnabledEmitter.event;

export async function asExternalUri(uri: Uri) {
  return uri;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export const uriScheme = 'vscode-test';
