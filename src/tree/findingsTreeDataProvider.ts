import * as vscode from 'vscode';
import FindingsIndex from '../services/findingsIndex';
import AnalysisManager from '../services/analysisManager';
import AppMapCollection from '../services/appmapCollection';
import { ImpactDomain, Rule } from '@appland/scanner';
import assert from 'assert';
import { DATE_BUCKETS, DateBucket, ResolvedFinding } from '../services/resolvedFinding';
import AppMapLoader from '../services/appmapLoader';

const IMPACT_DOMAINS = ['Security', 'Performance', 'Stability', 'Maintainability'];

const IMPACT_DOMAIN_ICONS = {
  Security: 'shield',
  Performance: 'dashboard',
  Stability: 'bug',
  Maintainability: 'tools',
};

type AppMapIndexException = {
  class: string;
  message: string;
  location: string;
  stack: string[];
};

class AppMapException {
  constructor(public appmap: AppMapLoader, public exception: AppMapIndexException) {}
}

class WorkspaceFolderTreeItem extends vscode.TreeItem {
  constructor(public folder: vscode.WorkspaceFolder) {
    super(folder.name, vscode.TreeItemCollapsibleState.Expanded);
  }

  filterAppMaps(appmaps: AppMapLoader[]): AppMapLoader[] {
    return appmaps.filter(
      (appmap) =>
        appmap.descriptor.metadata?.test_status === 'failed' &&
        appmap.descriptor.resourceUri.fsPath.startsWith(this.folder.uri.fsPath)
    );
  }

  filterFindings(findings: ResolvedFinding[]): ResolvedFinding[] {
    return findings.filter((finding) => finding.folder === this.folder);
  }
}

class FailedTestsTreeItem extends vscode.TreeItem {
  constructor(public workspaceFolderTreeItem: WorkspaceFolderTreeItem) {
    super('Failed tests', vscode.TreeItemCollapsibleState.Expanded);
  }

  filterAppMaps(appmaps: AppMapLoader[]) {
    return this.workspaceFolderTreeItem.filterAppMaps(appmaps);
  }
}

class ExceptionsTreeItem extends vscode.TreeItem {
  constructor(public workspaceFolderTreeItem: WorkspaceFolderTreeItem) {
    super('Exceptions', vscode.TreeItemCollapsibleState.Expanded);
  }

  filterAppMaps(appmaps: AppMapLoader[]) {
    return this.workspaceFolderTreeItem
      .filterAppMaps(appmaps)
      .filter((appmap) => appmap.descriptor.exceptions);
  }
}

class FindingsTreeItem extends vscode.TreeItem {
  constructor(public workspaceFolderTreeItem: WorkspaceFolderTreeItem) {
    super('Findings', vscode.TreeItemCollapsibleState.Expanded);
  }
}

class FailedTestTreeItem extends vscode.TreeItem {
  constructor(public failedTestsTreeItem: FailedTestsTreeItem, public appmap: AppMapLoader) {
    super(appmap.descriptor.metadata?.name || '<unnamed appmap>');

    this.command = {
      title: 'Open',
      command: 'vscode.openWith',
      arguments: [this.appmap.descriptor.resourceUri, 'appmap.views.appMapFile'],
    };
    this.contextValue = 'appmap.views.analysis.failedTest';
  }
}

class ExceptionDateBucketTreeItem extends vscode.TreeItem {
  constructor(public exceptionsTreeItem: ExceptionsTreeItem, public dateBucket: DateBucket) {
    super(
      dateBucket.label,
      dateBucket.expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    if (dateBucket.icon) this.iconPath = new vscode.ThemeIcon(dateBucket.icon);
  }

  filterAppMaps(appmaps: AppMapLoader[]): AppMapException[] {
    return this.exceptionsTreeItem
      .filterAppMaps(appmaps)
      .filter((appmap) => this.dateBucket.filter(appmap.descriptor.exceptionModifiedDate));
  }
}

class FindingDateBucketTreeItem extends vscode.TreeItem {
  constructor(
    public workspaceFolderTreeItem: WorkspaceFolderTreeItem,
    public dateBucket: DateBucket
  ) {
    super(
      dateBucket.label,
      dateBucket.expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );

    if (dateBucket.icon) this.iconPath = new vscode.ThemeIcon(dateBucket.icon);
  }

  filterFindings(findings: ResolvedFinding[]): ResolvedFinding[] {
    return this.workspaceFolderTreeItem
      .filterFindings(findings)
      .filter((finding) => this.dateBucket.filter(finding.finding));
  }
}

class ImpactDomainTreeItem extends vscode.TreeItem {
  constructor(
    public dateBucketTreeItem: FindingDateBucketTreeItem,
    public impactDomain: ImpactDomain
  ) {
    super(impactDomain, vscode.TreeItemCollapsibleState.Collapsed);

    const icon = IMPACT_DOMAIN_ICONS[impactDomain];

    if (icon) this.iconPath = new vscode.ThemeIcon(icon);
  }

  filterFindings(findings: ResolvedFinding[]): ResolvedFinding[] {
    return this.dateBucketTreeItem
      .filterFindings(findings)
      .filter((finding) => finding.impactDomain === this.impactDomain);
  }
}

class RuleTreeItem extends vscode.TreeItem {
  constructor(public impactDomainTreeItem: ImpactDomainTreeItem, public rule: Rule) {
    super(rule.title, vscode.TreeItemCollapsibleState.Collapsed);
  }

  filterFindings(findings: ResolvedFinding[]): ResolvedFinding[] {
    return this.impactDomainTreeItem
      .filterFindings(findings)
      .filter((finding) => finding.rule.id === this.rule.id);
  }
}

class FindingTreeItem extends vscode.TreeItem {
  constructor(public ruleTreeItem: RuleTreeItem, public finding: ResolvedFinding) {
    super(FindingTreeItem.label(finding));

    const hashV2 = finding.finding.hash_v2;
    this.command = {
      command: 'appmap.openFindingInfo',
      title: `Finding Info`,
      arguments: [hashV2],
    };

    this.tooltip = finding.finding.message;
    this.id = hashV2;
    this.contextValue = 'appmap.views.analysis.finding';
  }

  static label(finding: ResolvedFinding): string {
    const { event } = finding.finding;
    const req = event['http_server_request'];
    return (
      finding.locationLabel ||
      event.path ||
      finding.finding.stack[0] ||
      (req && `${req?.request_method} ${req?.path_info}`)
    );
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

    appmaps.onUpdated(() => this._onDidChangeTreeData.fire(undefined));

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.fixTest',
        async (item: FailedTestTreeItem) => {
          vscode.commands.executeCommand('appmap.fixTest', item.appmap.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.fixFinding',
        async (item: FindingTreeItem) => {
          vscode.commands.executeCommand('appmap.fixFinding', item.finding.finding.hash_v2);
        }
      )
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

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element;
  }

  getTopLevelTreeItems(): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    if (!vscode.workspace.workspaceFolders) return [];

    if (this.appmaps.appMaps().length === 0) return [];

    const projects = vscode.workspace.workspaceFolders || [];

    const overviewTreeItem = new vscode.TreeItem('Findings table');
    overviewTreeItem.command = {
      command: 'appmap.openFindingsOverview',
      title: `Open in AppMap`,
    };
    overviewTreeItem.iconPath = new vscode.ThemeIcon('preview');

    const projectsWithFindings = this.findingsIndex
      ?.findings()
      .reduce((projectsWithFindings, finding) => {
        const project = projects.find((project) =>
          finding.sourceUri.fsPath.startsWith(project.uri.fsPath)
        );
        if (project) projectsWithFindings.add(project);
        return projectsWithFindings;
      }, new Set<vscode.WorkspaceFolder>());

    const projectsWithAppMaps = this.appmaps.allAppMaps().reduce((projectsWithAppMaps, appmap) => {
      const project = projects.find((project) =>
        appmap.descriptor.resourceUri.fsPath.startsWith(project.uri.fsPath)
      );
      if (project) projectsWithAppMaps.add(project);
      return projectsWithAppMaps;
    }, new Set<vscode.WorkspaceFolder>());

    const projectTreeItems = projects
      .filter((project) => projectsWithFindings.has(project) || projectsWithAppMaps.has(project))
      .map((project) => new WorkspaceFolderTreeItem(project));

    return [overviewTreeItem, ...projectTreeItems];
  }

  public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    if (!element) {
      return this.getTopLevelTreeItems();
    }

    if (element instanceof WorkspaceFolderTreeItem) {
      return this.getFolderTreeItems(element);
    } else if (element instanceof FailedTestsTreeItem) {
      return this.getFailedTestsTreeItems(element);
    } else if (element instanceof FindingsTreeItem) {
      return this.getFindingsTreeItems(element);
    } else if (element instanceof FindingDateBucketTreeItem) {
      return this.getChildrenForDateBucket(element);
    } else if (element instanceof ImpactDomainTreeItem) {
      return this.getChildrenForImpactDomain(element);
    } else if (element instanceof RuleTreeItem) {
      return this.getChildrenForRule(element);
    } else {
      return [];
    }
  }

  getFolderTreeItems(folderTreeItem: WorkspaceFolderTreeItem): vscode.TreeItem[] {
    const result: vscode.TreeItem[] = [];
    const appmaps = folderTreeItem.filterAppMaps(this.appmaps.allAppMaps());
    if (appmaps.length > 0) result.push(new FailedTestsTreeItem(folderTreeItem));

    if (this.findingsIndex) {
      const findings = folderTreeItem.filterFindings(this.findingsIndex?.findings());
      if (findings.length > 0) result.push(new FindingsTreeItem(folderTreeItem));
    }

    return result;
  }

  getFindingsTreeItems(findingsTreeItem: FindingsTreeItem): vscode.TreeItem[] {
    assert(this.findingsIndex);

    const findings = findingsTreeItem.workspaceFolderTreeItem.filterFindings(
      this.findingsIndex?.findings()
    );
    const findingBuckets = new Set(findings.map((finding) => finding.dateBucket));
    return DATE_BUCKETS.filter((bucket) => findingBuckets.has(bucket)).map((bucket) => {
      return new FindingDateBucketTreeItem(findingsTreeItem.workspaceFolderTreeItem, bucket);
    });
  }

  getFailedTestsTreeItems(failedTestsTreeItem: FailedTestsTreeItem): vscode.TreeItem[] {
    return failedTestsTreeItem
      .filterAppMaps(this.appmaps.allAppMaps())
      .map((appmap) => new FailedTestTreeItem(failedTestsTreeItem, appmap));
  }

  getChildrenForDateBucket(dateBucketTreeItem: FindingDateBucketTreeItem): vscode.TreeItem[] {
    assert(this.findingsIndex);
    const findings = dateBucketTreeItem.filterFindings(this.findingsIndex?.findings());
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
      return new ImpactDomainTreeItem(dateBucketTreeItem, impactDomain);
    }, []);
  }

  getChildrenForImpactDomain(impactDomainTreeItem: ImpactDomainTreeItem): vscode.TreeItem[] {
    assert(this.findingsIndex);
    const findings = impactDomainTreeItem.filterFindings(
      this.findingsIndex.findingsByImpactDomain(impactDomainTreeItem.impactDomain)
    );
    const ruleByRuleId = findings.reduce((ruleByRuleId, finding) => {
      assert(finding.rule);
      if (!ruleByRuleId.has(finding.finding.ruleId))
        ruleByRuleId.set(finding.finding.ruleId, finding.rule);
      return ruleByRuleId;
    }, new Map<string, Rule>());

    return [...ruleByRuleId.values()]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((rule) => new RuleTreeItem(impactDomainTreeItem, rule));
  }

  getChildrenForRule(ruleTreeItem: RuleTreeItem): vscode.TreeItem[] {
    if (!this.findingsIndex) return [];

    const findings = ruleTreeItem.filterFindings(
      this.findingsIndex.distinctFindingsByRuleId(ruleTreeItem.rule.id)
    );

    return findings.map((finding) => new FindingTreeItem(ruleTreeItem, finding));
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
    this.onChangeDisposable?.dispose();
  }
}
