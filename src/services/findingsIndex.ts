import * as vscode from 'vscode';
import { Finding } from '@appland/scanner/built/cli';
import { ResolvedFinding } from './resolvedFinding';
import { promisify } from 'util';
import { readFile } from 'fs';
import EventEmitter from 'events';
import { fileExists } from '../util';

export default class FindingsIndex extends EventEmitter {
  private _onChanged = new vscode.EventEmitter<FindingsIndex>();
  public readonly onChanged = this._onChanged.event;

  private findingsBySourceUri = new Map<string, ResolvedFinding[]>();

  findingsForUri(uri: vscode.Uri): ResolvedFinding[] {
    return this.findingsBySourceUri[uri.toString()] || [];
  }

  findings(): ResolvedFinding[] {
    return Object.values(this.findingsBySourceUri).flat();
  }

  clear(): void {
    const sourceUris = Object.keys(this.findingsBySourceUri);
    this.findingsBySourceUri = new Map();
    sourceUris.forEach((sourceUri) => {
      this.emit('removed', vscode.Uri.parse(sourceUri));
    });
    this._onChanged.fire(this);
  }

  async addFindingsFile(sourceUri: vscode.Uri): Promise<void> {
    console.log(`Findings file added: ${sourceUri.fsPath}`);

    let findingsData: Buffer;
    let findings: Finding[];

    try {
      findingsData = await promisify(readFile)(sourceUri.fsPath);
    } catch (e) {
      if ((e as any).code !== 'ENOENT') console.warn(e);
      return;
    }

    try {
      findings = JSON.parse(findingsData.toString()).findings;
    } catch (e) {
      // Malformed JSON file. This is unexpected because findings files should be written atomically.
      // TODO: Retry in a little while?
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

    this.emit('added', sourceUri, resolvedFindings);
    this._onChanged.fire(this);
  }

  async removeFindingsFile(sourceUri: vscode.Uri): Promise<void> {
    if (await fileExists(sourceUri.fsPath)) return;

    console.log(`Findings file removed: ${sourceUri.fsPath}`);

    delete this.findingsBySourceUri[sourceUri.toString()];

    this.emit('removed', sourceUri);
    this._onChanged.fire(this);
  }
}
