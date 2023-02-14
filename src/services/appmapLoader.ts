import * as vscode from 'vscode';
import { AppMap } from '@appland/models';

export type AppMapMetadata = Partial<AppMap['metadata']> & {
  collection?: string;
};

export interface AppMapDescriptor {
  resourceUri: vscode.Uri;
  timestamp: number;
  metadata?: AppMapMetadata;
  numRequests?: number;
  numQueries?: number;
  numFunctions?: number;
}

export default interface AppMapLoader {
  descriptor: AppMapDescriptor;

  loadAppMap(): Promise<AppMap>;
}
