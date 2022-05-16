import * as vscode from 'vscode';
import { Finding } from '@appland/scanner/built/cli';
import { ResolvedFinding } from './resolvedFinding';
import { promisify } from 'util';
import { readFile } from 'fs';

export default class FindingsIndex {
  private _onChanged = new vscode.EventEmitter<vscode.Uri>();
  public readonly onChanged = this._onChanged.event;

  private findingsBySourceUri = new Map<string, ResolvedFinding[]>();

  findingsForUri(uri: vscode.Uri): ResolvedFinding[] {
    return this.findingsBySourceUri[uri.toString()] || [];
  }

  findings(): ResolvedFinding[] {
    return Object.values(this.findingsBySourceUri).flat();
  }

  async addFindingsFile(sourceUri: vscode.Uri): Promise<void> {
    console.log(`Findings file added: ${sourceUri.fsPath}`);

    const findingsData = await promisify(readFile)(sourceUri.fsPath);
    let findings: Finding[];
    try {
      findings = JSON.parse(findingsData.toString()).findings;
    } catch (e) {
      // Malformed JSON file. This is logged because findings files should be written atomically.
      console.warn(e);
      return;
    }

    if (!findings) {
      console.log(`Findings from ${sourceUri} is falsey`);
      return;
    }

    const resolvedFindings = await Promise.all(
      findings.map(
        async (finding: Finding): Promise<ResolvedFinding> => {
          const resolvedFinding = new ResolvedFinding(sourceUri, finding);
          await resolvedFinding.initialize();
          return resolvedFinding;
        }
      )
    );
    this.findingsBySourceUri[sourceUri.toString()] = resolvedFindings;

    this._onChanged.fire(sourceUri);
  }

  removeFindingsFile(sourceUri: vscode.Uri): void {
    console.log(`Findings file removed: ${sourceUri.fsPath}`);

    delete this.findingsBySourceUri[sourceUri.toString()];

    this._onChanged.fire(sourceUri);
  }
}
