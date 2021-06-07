import * as vscode from 'vscode';
import { AppMap } from '@appland/models';

export default interface AppMapDescriptor {
  resourceUri: vscode.Uri;
  metadata?: Record<string, unknown>;

  loadAppMap(): Promise<AppMap>;
}
