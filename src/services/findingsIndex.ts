import * as vscode from 'vscode';
import { Finding } from '@appland/scanner/built/cli';
import { ResolvedFinding } from './resolvedFinding';
import { promisify } from 'util';
import { readFile } from 'fs';
import EventEmitter from 'events';
import { fileExists } from '../util';
import uniq from '../lib/uniq';
import { Check } from '@appland/scanner';

export default class FindingsIndex extends EventEmitter implements vscode.Disposable {
  private _onChanged = new vscode.EventEmitter<vscode.WorkspaceFolder>();
  public readonly onChanged = this._onChanged.event;

  private findingsBySourceUri = new Map<string, ResolvedFinding[]>();

  uniqueFindingsForWorkspace(workspaceFolder: vscode.WorkspaceFolder): ResolvedFinding[] {
    const all = Object.entries(this.findingsBySourceUri)
      .filter(([sourceUri]) => sourceUri.startsWith(workspaceFolder.uri.toString()))
      .flatMap(([, findings]) => findings);
    return uniq(all, (rf) => rf.finding.hash);
  }

  findingsForUri(uri: vscode.Uri): ResolvedFinding[] {
    return this.findingsBySourceUri[uri.toString()] || [];
  }

  findings(): ResolvedFinding[] {
    return Object.values(this.findingsBySourceUri).flat();
  }

  clear(): void {
    const sourceUris = Object.keys(this.findingsBySourceUri);
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const affectedWorkspaces = workspaceFolders.filter((wsFolder) =>
      sourceUris.find((sourceUri) => sourceUri.startsWith(wsFolder.uri.toString()))
    );

    this.findingsBySourceUri = new Map();

    sourceUris.forEach((sourceUri) => {
      this.emit('removed', vscode.Uri.parse(sourceUri));
    });

    affectedWorkspaces.forEach((workspaceFolder) => this._onChanged.fire(workspaceFolder));
  }

  async addFindingsFile(
    sourceUri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<void> {
    let findingsData: Buffer;
    let findings: Finding[];
    let checks: Check[];

    try {
      findingsData = await promisify(readFile)(sourceUri.fsPath);
    } catch (e) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      if ((e as any).code !== 'ENOENT') console.warn(e);
      return;
    }

    const findingsDataStr = findingsData.toString();

    try {
      const appmapFindings = JSON.parse(findingsDataStr);
      findings = appmapFindings.findings;
      checks = appmapFindings.checks || [];
    } catch (e) {
      // Malformed JSON file. This is unexpected because findings files should be written atomically.
      // TODO: Retry in a little while?
      if (!(e instanceof SyntaxError)) console.warn(e);
      return;
    }

    if (!findings) {
      console.log(`Findings from ${sourceUri} is falsey`);
      return;
    }

    const resolvedFindings = await Promise.all(
      findings.map(
        async (finding: Finding): Promise<ResolvedFinding> => {
          const resolvedFinding = new ResolvedFinding(sourceUri, finding, checks);
          await resolvedFinding.initialize();
          return resolvedFinding;
        }
      )
    );
    this.findingsBySourceUri[sourceUri.toString()] = resolvedFindings;

    this.emit('added', sourceUri, resolvedFindings);
    this._onChanged.fire(workspaceFolder);
  }

  async removeFindingsFile(
    sourceUri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<void> {
    if (await fileExists(sourceUri.fsPath)) return;

    delete this.findingsBySourceUri[sourceUri.toString()];

    this.emit('removed', sourceUri);
    this._onChanged.fire(workspaceFolder);
  }

  findingsByImpactDomain(impactDomain: string): ResolvedFinding[] {
    return this.findings().filter(({ finding }) => finding.impactDomain === impactDomain);
  }

  findingsByHash(hash: string): ResolvedFinding[] {
    return this.findings().filter(({ finding }) => finding.hash_v2 === hash);
  }

  uniqueFindingsByRuleTitle(ruleTitle: string): ResolvedFinding[] {
    const findingsByRuleTitle = this.findings().filter(
      ({ finding }) => finding.ruleTitle === ruleTitle
    );

    const uniqueFindingsByHash = findingsByRuleTitle.reduce((accumulator, finding) => {
      const hashV2 = finding.finding.hash_v2;

      if (!(hashV2 in accumulator)) {
        accumulator[hashV2] = finding;
      }

      return accumulator;
    }, {});

    return Object.values(uniqueFindingsByHash);
  }

  dispose(): void {
    this._onChanged.dispose();
  }
}
