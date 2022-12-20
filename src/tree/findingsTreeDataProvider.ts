import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import AnalysisManager from '../services/analysisManager';

const IMPACT_DOMAINS = ['Security', 'Performance', 'Stability', 'Maintainability'];

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

  public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    if (!element) {
      return this.getTopLevelTreeItems();
    }

    const label = String(element.label);
    if (IMPACT_DOMAINS.includes(label)) {
      return this.getChildrenForImpactDomain(label);
    }

    return this.getChildrenForRule(label);
  }

  getTopLevelTreeItems(): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    const topLevelTreeLabels = this.findingsIndex
      .findings()
      .reduce((impactDomains, finding) => {
        const impactDomain = finding.finding.impactDomain;

        if (impactDomain && !impactDomains.includes(impactDomain)) {
          impactDomains.push(impactDomain);
        }

        return impactDomains;
      }, [] as string[])
      .sort((labelA, labelB) => IMPACT_DOMAINS.indexOf(labelA) - IMPACT_DOMAINS.indexOf(labelB));

    const overviewTreeItem = new vscode.TreeItem('Overview');
    overviewTreeItem.command = {
      command: 'appmap.openFindingsOverview',
      title: `Open in AppMap`,
    };
    overviewTreeItem.iconPath = new vscode.ThemeIcon('preview');

    return topLevelTreeLabels.reduce(
      (treeItems, impactDomain) => {
        const treeItem = new vscode.TreeItem(
          impactDomain,
          vscode.TreeItemCollapsibleState.Expanded
        );

        treeItems.push(treeItem);
        return treeItems;
      },
      [overviewTreeItem]
    );
  }

  getChildrenForImpactDomain(impactDomain: string): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    const findingsInImpactDomain = this.findingsIndex.findingsByImpactDomain(impactDomain);

    const ruleTitles = findingsInImpactDomain.reduce((titles, finding) => {
      const ruleTitle = finding.finding.ruleTitle;

      if (!titles.includes(ruleTitle)) {
        titles.push(ruleTitle);
      }

      return titles;
    }, [] as string[]);

    return ruleTitles
      .sort((ruleA, ruleB) => (ruleA < ruleB ? -1 : 1))
      .map((title) => {
        return new vscode.TreeItem(title, vscode.TreeItemCollapsibleState.Expanded);
      });
  }

  getChildrenForRule(ruleTitle: string): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    const uniqueFindingsByRuleTitle = this.findingsIndex.uniqueFindingsByRuleTitle(ruleTitle);

    return uniqueFindingsByRuleTitle.map((finding) => {
      const hashV2 = finding.finding.hash_v2;
      const { event } = finding.finding;
      const req = event['http_server_request'];
      const label =
        finding.locationLabel ||
        event.path ||
        finding.finding.stack[0] ||
        (req && `${req?.request_method} ${req?.path_info}`);

      const treeItem = new vscode.TreeItem(String(label));

      treeItem.command = {
        command: 'appmap.openFindingInfo',
        title: `Finding Info`,
        arguments: [hashV2],
      };

      treeItem.tooltip = finding.finding.message;
      treeItem.id = hashV2;

      return treeItem;
    });
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.onChangeDisposable?.dispose();
  }
}
