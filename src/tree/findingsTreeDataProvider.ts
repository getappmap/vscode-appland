import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import { ResolvedFinding } from '../services/resolvedFinding';
import generateTitle from '../lib/generateDisplayTitle';
import AnalysisManager from '../services/analysisManager';

export class FindingsTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable {
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

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(): vscode.TreeItem[] {
    if (!this.findingsIndex) {
      return [];
    }

    const uniqueFindings: { [key: string]: ResolvedFinding } = this.findingsIndex
      .findings()
      .reduce((acc, finding) => {
        acc[finding.finding.hash] = finding;
        return acc;
      }, {});

    return Object.values(uniqueFindings)
      .map(
        (finding: ResolvedFinding): vscode.TreeItem => {
          const item = new vscode.TreeItem(generateTitle(finding));
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
      )
      .sort((a, b) => (a.label || '').toString().localeCompare((b.label || '').toString()));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.onChangeDisposable?.dispose();
  }
}
