import { Event } from '@appland/models';
import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import { ResolvedFinding } from '../services/resolvedFinding';

export class FindingsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;
  findingsIndex: FindingsIndex;

  constructor(findingsIndex: FindingsIndex) {
    this.findingsIndex = findingsIndex;
    this.findingsIndex.onChanged(() => this._onDidChangeTreeData.fire());
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(): vscode.TreeItem[] {
    return this.findingsIndex.findings().map(
      (finding: ResolvedFinding): vscode.TreeItem => {
        const item = new vscode.TreeItem(finding.finding.message);
        // TODO: Revisit how to make this id unique.
        item.id = [
          finding.finding.ruleId,
          finding.finding.message,
          finding.finding.relatedEvents.map((e: Event) => e.id),
        ]
          .flat()
          .join('\n');
        if (finding.problemLocation) {
          item.command = {
            title: 'Open',
            command: 'vscode.open',
            arguments: [finding.problemLocation.uri],
          };
        }
        return item;
      }
    );
  }
}
