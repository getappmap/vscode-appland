import path from 'path';
import * as vscode from 'vscode';
import AnalysisManager from '../services/analysisManager';
import { ResolvedFinding } from '../services/resolvedFinding';
import { Finding, Rule } from '@appland/scanner';
import { getStackLocations, StackLocation } from '../lib/getStackLocations';
import getWebviewContent from './getWebviewContent';

type FindingData = {
  finding: Finding;
  appMapUri?: vscode.Uri;
  problemLocation?: vscode.Location;
  stackLocations: StackLocation[];
  ruleInfo?: RuleInfo;
  appMapName: string;
};

type LocationInfo = {
  uri: {
    path: string;
    scheme: string;
    fsPath: string;
  };
  range: Array<{
    line: number;
    character: number;
  }>;
};

type RuleInfo = {
  id: string;
  description: string;
  title: string;
  references?: Record<string, URL>;
  impactDomain?: string;
  labels?: Array<string>;
  scope?: string;
};

type WebPanelHolder = {
  [hash: string]: vscode.WebviewPanel;
};

function openInSource(location: LocationInfo): void {
  const { uri, range } = location;
  const [start, end] = range;
  const selection = new vscode.Range(start.line, start.character, end.line, end.character);
  vscode.window.showTextDocument(vscode.Uri.file(uri.path), { selection });
}

function generateRuleInfo(rule: Rule | undefined): RuleInfo | undefined {
  if (!rule) return;

  const { id, description, impactDomain, title, references, labels, scope } = rule;

  return {
    id,
    description,
    impactDomain,
    title,
    references,
    labels,
    scope,
  };
}

function filterFinding(resolvedFinding: ResolvedFinding): FindingData {
  const ruleInfo = generateRuleInfo(resolvedFinding.rule);
  const stackLocations = getStackLocations(resolvedFinding);
  const appMapName = path.basename(resolvedFinding.finding.appMapFile).split('.')[0];
  const { finding, appMapUri, problemLocation } = resolvedFinding;
  return { ruleInfo, stackLocations, finding, appMapUri, problemLocation, appMapName };
}

export default class FindingInfoWebview {
  private static existingPanels = {} as WebPanelHolder;
  private static findingsIndex = AnalysisManager.findingsIndex;

  public static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.openFindingInfo', async (hash: string) => {
        if (!this.findingsIndex) {
          this.findingsIndex = AnalysisManager.findingsIndex;
        }
        const findings = this.findingsIndex?.findingsByHash(hash).map(filterFinding);

        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanels && this.existingPanels[hash]) {
          this.existingPanels[hash].reveal(vscode.ViewColumn.One);
          this.existingPanels[hash].webview.postMessage({
            type: 'open-new-finding',
            findings,
          });
          return;
        }

        const panelTitle = (findings && findings[0]?.finding.ruleTitle) || 'Finding Info';

        const panel = vscode.window.createWebviewPanel(
          'findingInfo',
          panelTitle,
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.existingPanels[hash] = panel;
        panel.webview.html = getWebviewContent(
          panel.webview,
          context,
          panelTitle,
          'finding-info-view'
        );

        panel.onDidDispose(() => {
          delete this.existingPanels[hash];
        });

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'findingsInfoReady':
              panel.webview.postMessage({
                type: 'initFindingsInfo',
                findings,
              });

              break;
            case 'open-in-source-code':
              {
                const location = message.data;
                openInSource(location);
              }
              break;
            case 'open-map':
              {
                let state: string | undefined;

                if (message.data.uri) state = message.data.uri.fragment;

                const uri = vscode.Uri.file(message.data.mapFile);
                vscode.commands.executeCommand('vscode.open', uri.with({ fragment: state }));
              }
              break;
            case 'open-findings-overview':
              {
                vscode.commands.executeCommand('appmap.openFindingsOverview');
              }
              break;
          }
        });
      })
    );
  }
}
