import * as vscode from 'vscode';
import { AppMap } from '@appland/models';

export interface AppMapDescriptor {
  resourceUri: vscode.Uri;
  metadata?: Record<string, unknown>;
  numRequests?: number;
  numQueries?: number;
  numFunctions?: number;
}

export default interface AppMapLoader {
  descriptor: AppMapDescriptor;

  loadAppMap(): Promise<AppMap>;
}
