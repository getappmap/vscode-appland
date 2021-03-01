import * as vscode from 'vscode';
// @ts-ignore
import { AppMap } from '@appland/appmap';

export default interface AppMapDescriptor {
  resourceUri: vscode.Uri;
  metadata?: Record<string, unknown>;

  loadAppMap(): Promise<AppMap>;
}
