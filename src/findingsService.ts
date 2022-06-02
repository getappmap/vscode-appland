import * as vscode from 'vscode';
import { ResolvedFinding } from './services/resolvedFinding';

export interface FindingsService {
  findingsForUri: (uri: vscode.Uri) => ResolvedFinding[];
  findings: () => ResolvedFinding[];

  onChanged(listener: () => void): void;
}
