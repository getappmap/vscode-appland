import * as path from 'path';
import * as vscode from 'vscode';
import ProjectWatcher from '../projectWatcher';
import { getNonce } from '../util';
import { Telemetry, MILESTONE_OPEN_WEBVIEW } from '../telemetry';
import QuickstartDocsOpenAppmaps from './openAppmapsWebview';

export default class QuickstartDocsRecordAppmaps {
  public static readonly viewType = 'appmap.views.quickstart';
  public static readonly command = 'appmap.openQuickstartDocsRecordAppmaps';

  // Keyed by project root directory
  private static readonly openWebviews = new Map<string, vscode.WebviewPanel>();

  public static register(
    context: vscode.ExtensionContext,
    projects: readonly ProjectWatcher[]
  ): void {
    const project = projects[0];
    if (!project) {
      // No project, so no quickstart
      return;
    }

    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, () => {
        // Attempt to re-use an existing webview for this project if one exists
        const existingPanel: vscode.WebviewPanel = this.openWebviews[
          project.rootDirectory as string
        ];
        if (existingPanel) {
          existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Quickstart: Record AppMaps',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        // Cache this panel so we can reuse it later if the user clicks another quickstart milestone from the tree view
        this.openWebviews[project.rootDirectory as string] = panel;

        // If the user closes the panel, make sure it's no longer cached
        panel.onDidDispose(() => {
          delete this.openWebviews[project.rootDirectory as string];
        });

        panel.webview.html = getWebviewContent(panel.webview, context);

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'preInitialize':
              {
                // The webview has been created but may not be ready to receive all messages yet.
                panel.webview.postMessage({
                  type: 'init',
                  language: project.language,
                });
              }
              break;
            case 'clickLink':
              Telemetry.reportOpenUri(message.uri);
              break;
            case 'postInitialize':
              Telemetry.sendEvent(MILESTONE_OPEN_WEBVIEW, {
                milestone: project.milestones.RECORD_APPMAP,
              });
              break;
            case 'transition':
              if (message.target === 'OPEN_APPMAPS') {
                vscode.commands.executeCommand(QuickstartDocsOpenAppmaps.command);
              }
              break;
            default:
              break;
          }
        });

        vscode.commands.executeCommand('appmap.focusQuickstartDocs', 2);
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
      AppLandWeb.mountQuickstartRecordAppmaps();
    </script>
  </body>
  </html>`;
}
