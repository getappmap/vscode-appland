import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import { ResolvedFinding } from '../services/resolvedFinding';
import generateTitle from '../lib/generateDisplayTitle';
import AnalysisManager from '../services/analysisManager';
import memoize from '../lib/memoize';
import uniq from '../lib/uniq';

const title = memoize(generateTitle);

export class FindingsTreeDataProvider
  implements vscode.TreeDataProvider<ResolvedFinding>, vscode.Disposable {
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private findingsIndex?: FindingsIndex;
  private onChangeDisposable?: vscode.Disposable;

  constructor(context: vscode.ExtensionContext) {
    AnalysisManager.onAnalysisToggled(
      () => this.setFindingsIndex(AnalysisManager.findingsIndex),
      undefined,
      context.subscriptions
    );
  }

  public setFindingsIndex(findingsIndex?: FindingsIndex): void {
    if (this.findingsIndex !== findingsIndex) {
      this.onChangeDisposable?.dispose();
      this.onChangeDisposable = undefined;
    }

    this.findingsIndex = findingsIndex;

    if (this.findingsIndex) {
      this.onChangeDisposable = this.findingsIndex.onChanged(() =>
        this._onDidChangeTreeData.fire(undefined)
      );
    }

    this._onDidChangeTreeData.fire(undefined);
  }

  public getTreeItem(finding: ResolvedFinding): vscode.TreeItem {
    const item = new vscode.TreeItem(title(finding));
    item.id = finding.finding.hash;
    if (finding.problemLocation) {
      item.command = {
        title: 'Open',
        command: 'appmap.openFinding',
        arguments: [finding.problemLocation.uri],
      };
    }
    return item;
  }

  public getChildren(): ResolvedFinding[] {
    if (!this.findingsIndex) return [];

    const unique = uniq(this.findingsIndex.findings(), ({ finding: { hash } }) => hash);
    return unique.sort((a, b) => title(a).localeCompare(title(b)));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.onChangeDisposable?.dispose();
  }
}
