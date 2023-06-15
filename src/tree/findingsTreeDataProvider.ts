import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import AnalysisManager from '../services/analysisManager';
import AppMapCollection from '../services/appmapCollection';
import { ImpactDomain, Rule } from '@appland/scanner';
import assert from 'assert';
import { DATE_BUCKETS, DateBucket } from '../services/resolvedFinding';

const IMPACT_DOMAINS = ['Security', 'Performance', 'Stability', 'Maintainability'];

class DateBucketTreeItem extends vscode.TreeItem {
  constructor(public dateBucket: DateBucket, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(dateBucket.label, collapsibleState);
  }
}

class ImpactDomainTreeItem extends vscode.TreeItem {
  constructor(
    public dateBucket: DateBucket,
    public impactDomain: ImpactDomain,
    collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(impactDomain, collapsibleState);
  }
}

class RuleTreeItem extends vscode.TreeItem {
  constructor(public rule: Rule, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(rule.title, collapsibleState);
  }
}

export class FindingsTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>, vscode.Disposable
{
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private findingsIndex?: FindingsIndex;
  private onChangeDisposable?: vscode.Disposable;

  constructor(context: vscode.ExtensionContext, private appmaps: AppMapCollection) {
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
    const dateBucket = DATE_BUCKETS.find((bucket) => bucket.label === label);
    if (dateBucket) {
      return this.getChildrenForDateBucket(dateBucket);
    } else if (IMPACT_DOMAINS.includes(label)) {
      const impactDomainTreeItem = element as ImpactDomainTreeItem;
      return this.getChildrenForImpactDomain(
        impactDomainTreeItem.dateBucket,
        impactDomainTreeItem.impactDomain
      );
    } else {
      const ruleTreeItem = element as RuleTreeItem;
      return this.getChildrenForRule(ruleTreeItem.rule);
    }
  }

  getTopLevelTreeItems(): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    if (this.appmaps.appMaps().length === 0) return [];

    const overviewTreeItem = new vscode.TreeItem('Overview');
    overviewTreeItem.command = {
      command: 'appmap.openFindingsOverview',
      title: `Open in AppMap`,
    };
    overviewTreeItem.iconPath = new vscode.ThemeIcon('preview');

    const findingBuckets = new Set(
      this.findingsIndex?.findings().map((finding) => finding.dateBucket)
    );
    const dateBucketTreeItems = DATE_BUCKETS.filter((bucket) => findingBuckets.has(bucket)).map(
      (bucket) => {
        return new DateBucketTreeItem(bucket, vscode.TreeItemCollapsibleState.Expanded);
      }
    );

    return [overviewTreeItem, ...dateBucketTreeItems];
  }

  getChildrenForDateBucket(dateBucket: DateBucket): vscode.TreeItem[] {
    assert(this.findingsIndex);
    const findings = this.findingsIndex
      ?.findings()
      .filter((finding) => dateBucket.filter(finding.finding));

    const impactDomains = findings
      .reduce((impactDomains, finding) => {
        const impactDomain = finding.finding.impactDomain;

        if (impactDomain && !impactDomains.includes(impactDomain)) {
          impactDomains.push(impactDomain);
        }

        return impactDomains;
      }, [] as ImpactDomain[])
      .sort((labelA, labelB) => IMPACT_DOMAINS.indexOf(labelA) - IMPACT_DOMAINS.indexOf(labelB));

    return impactDomains.map((impactDomain) => {
      return new ImpactDomainTreeItem(
        dateBucket,
        impactDomain,
        vscode.TreeItemCollapsibleState.Expanded
      );
    }, []);
  }

  getChildrenForImpactDomain(
    dateBucket: DateBucket,
    impactDomain: ImpactDomain
  ): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    const findings = this.findingsIndex
      .findingsByImpactDomain(impactDomain)
      .filter((finding) => dateBucket.filter(finding.finding));

    const ruleByRuleId = findings.reduce((ruleByRuleId, finding) => {
      assert(finding.rule);
      if (!ruleByRuleId.has(finding.finding.ruleId))
        ruleByRuleId.set(finding.finding.ruleId, finding.rule);
      return ruleByRuleId;
    }, new Map<string, Rule>());
    return [...ruleByRuleId.values()]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((rule) => new RuleTreeItem(rule, vscode.TreeItemCollapsibleState.Collapsed));
  }

  getChildrenForRule(rule: Rule): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    const findings = this.findingsIndex.distinctFindingsByRuleId(rule.id);
    return findings.map((finding) => {
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
