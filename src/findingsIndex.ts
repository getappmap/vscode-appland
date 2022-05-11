import * as vscode from 'vscode';
import { Finding } from '@appland/scanner/built/cli';
import { ResolvedFinding } from './resolvedFinding';
import { promisify } from 'util';
import { readFile } from 'fs';

export default class FindingsIndex {
  private _onChanged = new vscode.EventEmitter<vscode.Uri>();
  public readonly onChanged = this._onChanged.event;

  private findingsBySourceUri = new Map<string, ResolvedFinding[]>();

  constructor(context: vscode.ExtensionContext) {
    const watchers: Record<string, vscode.Disposable> = {};

    const watchFolder = (folder: vscode.WorkspaceFolder) => {
      const findingsPattern = new vscode.RelativePattern(folder, `**/appmap-findings.json`);
      const watcher = vscode.workspace.createFileSystemWatcher(findingsPattern);
      watcher.onDidCreate(this.addFindingsFile.bind(this));
      watcher.onDidChange((file) => {
        this.removeFindingsFile(file);
        this.addFindingsFile(file);
      });
      watcher.onDidDelete(this.removeFindingsFile.bind(this));
      watchers[folder.uri.toString()] = watcher;
      context.subscriptions.push(watcher);
    };

    const unwatchFolder = (folder: vscode.WorkspaceFolder) => {
      const watcher = watchers[folder.uri.toString()];
      if (watcher) watcher.dispose();
    };

    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      e.added.forEach((folder) => {
        watchFolder(folder);
      });
      e.removed.forEach((folder) => {
        unwatchFolder(folder);
      });
    });

    (vscode.workspace.workspaceFolders || []).forEach(watchFolder);
  }

  async initialize(): Promise<void> {
    (await vscode.workspace.findFiles('**/appmap-findings.json', '**/node_modules/**')).map(
      this.addFindingsFile.bind(this)
    );
  }

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

    const resolvedFindings = await Promise.all(
      findings.map(
        async (finding: Finding): Promise<ResolvedFinding> => {
          console.log(`Resolving finding: ${finding.hash}`);
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
