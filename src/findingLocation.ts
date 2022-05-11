import * as vscode from 'vscode';
import { Finding } from '@appland/scanner/built/cli';

export type FindingLocation = {
  finding: Finding;
  location: vscode.Location;
};
