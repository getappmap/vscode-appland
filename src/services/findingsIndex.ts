import * as vscode from 'vscode';
import { Finding } from '@appland/scanner/built/cli';
import { ResolvedFinding } from './resolvedFinding';
import { promisify } from 'util';
import { readFile } from 'fs';
import EventEmitter from 'events';
import { fileExists } from '../util';

export default class FindingsIndex extends EventEmitter implements vscode.Disposable {
  private _onChanged = new vscode.EventEmitter<vscode.WorkspaceFolder>();
  public readonly onChanged = this._onChanged.event;

  private findingsBySourceUri = new Map<string, ResolvedFinding[]>();

  findingsForWorkspace(workspaceFolder: vscode.WorkspaceFolder): ResolvedFinding[] {
    return Object.entries(this.findingsBySourceUri)
      .filter(([sourceUri]) => sourceUri.startsWith(workspaceFolder.uri.toString()))
      .flatMap(([, findings]) => findings);
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

    try {
      findingsData = await promisify(readFile)(sourceUri.fsPath);
    } catch (e) {
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      if ((e as any).code !== 'ENOENT') console.warn(e);
      return;
    }

    const findingsDataStr = findingsData.toString();

    try {
      findings = JSON.parse(findingsDataStr).findings;
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
          const resolvedFinding = new ResolvedFinding(sourceUri, finding);
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

  dispose(): void {
    this._onChanged.dispose();
  }
}
