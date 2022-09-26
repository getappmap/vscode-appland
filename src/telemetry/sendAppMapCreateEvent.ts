import { Uri, WorkspaceFolder } from 'vscode';
import { APPMAP_CREATE, Telemetry } from '.';

let alreadySent = false;

export function sendAppMapCreateEvent(uri: Uri, workspaceFolder: WorkspaceFolder): void {
  if (alreadySent) return; // only send one event per session

  Telemetry.sendEvent(APPMAP_CREATE, {
    rootDirectory: workspaceFolder.uri.fsPath,
    uri: uri,
  });
  alreadySent = true;
}
