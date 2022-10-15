import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import { ResolvedFinding } from '../services/resolvedFinding';
import AnalysisManager from '../services/analysisManager';
import memoize from '../lib/memoize';
import uniq from '../lib/uniq';
import firstLine from '../lib/firstLine';

function tooltip({
  finding: { ruleTitle },
  locationLabel,
  groupDetails,
}: ResolvedFinding): vscode.MarkdownString {
  const result = new vscode.MarkdownString(`**${ruleTitle}**`);
  if (locationLabel) result.appendText('\n').appendMarkdown(`*${locationLabel}*`);
  if (groupDetails) result.appendCodeblock(`${groupDetails}`);
  return result;
}

const sortKey = memoize(({ finding: { ruleTitle }, locationLabel }: ResolvedFinding) =>
  [ruleTitle, locationLabel].join(', ')
);

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
    const {
      finding: { ruleTitle, hash },
      locationLabel,
      problemLocation,
      groupDetails,
    } = finding;
    const item = new vscode.TreeItem(ruleTitle);
    item.description = locationLabel || firstLine(groupDetails);
    item.tooltip = tooltip(finding);
    item.id = hash;
    if (problemLocation) {
      item.command = {
        title: 'Open',
        command: 'appmap.openFinding',
        arguments: [problemLocation.uri],
      };
    }
    return item;
  }

  public getChildren(): ResolvedFinding[] {
    if (!this.findingsIndex) return [];

    const unique = uniq(this.findingsIndex.findings(), ({ finding: { hash } }) => hash);
    return unique.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.onChangeDisposable?.dispose();
  }
}
