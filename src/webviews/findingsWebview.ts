import path from 'path';
import * as vscode from 'vscode';
import AnalysisManager from '../services/analysisManager';
import { ANALYSIS_VIEW_OVERVIEW, Telemetry } from '../telemetry';
import { getNonce } from '../util';

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
        panel.webview.html = getWebviewContent(panel.webview, context);

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

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.js'))
  );
  const nonce = getNonce();

  return ` <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>AppLand Scenario</title>
  </head>
  <body>
    <div id="app">
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
    <script type="text/javascript" nonce="${nonce}">
      AppLandWeb.mountFindingsView();
    </script>
  </body>
  </html>`;
}
