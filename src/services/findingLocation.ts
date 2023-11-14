import * as vscode from 'vscode';
import { Finding } from '@appland/scanner';

export type FindingLocation = {
  finding: Finding;
  location: vscode.Location;
};
