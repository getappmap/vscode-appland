import * as vscode from 'vscode';
import AnalysisManager from '../services/analysisManager';
import { ANALYSIS_VIEW_OVERVIEW, Telemetry } from '../telemetry';
import getWebviewContent from './getWebviewContent';

export default class FindingsOverviewWebview {
  private static existingPanel?: vscode.WebviewPanel;
  private static findingsIndex = AnalysisManager.findingsIndex;

  public static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.openFindingsOverview', async () => {
        if (!this.findingsIndex) {
          this.findingsIndex = AnalysisManager.findingsIndex;
        }

        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanel) {
          this.existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        Telemetry.sendEvent(ANALYSIS_VIEW_OVERVIEW, {
          findings: (this.findingsIndex?.findings() || []).map((f) => f.finding),
        });

        const panel = vscode.window.createWebviewPanel(
          'findingsOverview',
          'Findings Overview',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.existingPanel = panel;
        panel.webview.html = getWebviewContent(
          panel.webview,
          context,
          'Findings Overview',
          'findings-view'
        );

        this.findingsIndex?.on('added', () => {
          this.existingPanel?.webview.postMessage({
            type: 'findings',
            findings: this.findingsIndex?.findings(),
          });
        });
        this.findingsIndex?.on('removed', () => {
          this.existingPanel?.webview.postMessage({
            type: 'findings',
            findings: this.findingsIndex?.findings(),
          });
        });

        panel.onDidDispose(() => {
          this.existingPanel = undefined;
        });

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'findings-overview-ready':
              panel.webview.postMessage({
                type: 'initFindings',
                findings: this.findingsIndex?.findings(),
              });

              break;
            case 'open-finding-info':
              {
                const hash = message.data;
                vscode.commands.executeCommand('appmap.openFindingInfo', hash);
              }
              break;
            case 'open-problems-tab':
              {
                vscode.commands.executeCommand('workbench.panel.markers.view.focus');
              }
              break;
          }
        });
      })
    );
  }
}
