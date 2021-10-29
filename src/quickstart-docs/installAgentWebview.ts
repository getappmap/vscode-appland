import * as path from 'path';
import * as vscode from 'vscode';
import { getNonce } from '../util';
import { Telemetry, MILESTONE_OPEN_WEBVIEW, COPY_INSTALL_COMMAND } from '../telemetry';
import AppMapProperties from '../appmapProperties';
import QuickstartDocsRecordAppmaps from './recordAppmapsWebview';

export default class QuickstartDocsInstallAgent {
  public static readonly viewType = 'appmap.views.quickstart';
  public static readonly command = 'appmap.openQuickstartDocsInstallAgent';

  // Keyed by project root directory
  private static readonly openWebviews = new Map<string, vscode.WebviewPanel>();

  public static async register(
    context: vscode.ExtensionContext,
    _properties: AppMapProperties
  ): Promise<void> {
    const rootDirectory = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, () => {
        // Attempt to re-use an existing webview for this project if one exists
        const existingPanel: vscode.WebviewPanel = this.openWebviews[rootDirectory as string];
        if (existingPanel) {
          existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Quickstart: Install Appmap Agent',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        // Cache this panel so we can reuse it later if the user clicks another quickstart milestone from the tree view
        this.openWebviews[rootDirectory as string] = panel;

        // If the user closes the panel, make sure it's no longer cached
        panel.onDidDispose(() => {
          delete this.openWebviews[rootDirectory as string];
        });

        panel.webview.html = getWebviewContent(panel.webview, context, rootDirectory);

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'preInitialize':
              {
                // The webview has been created but may not be ready to receive all messages yet.
                panel.webview.postMessage({
                  type: 'init',
                });
              }
              break;
            case 'clickLink':
              Telemetry.reportOpenUri(message.uri);
              break;
            case 'postInitialize':
              Telemetry.sendEvent(MILESTONE_OPEN_WEBVIEW, {
                milestoneId: 'INSTALL_AGENT',
              });
              break;
            case 'transition':
              if (message.target === 'RECORD_APPMAPS') {
                vscode.commands.executeCommand(QuickstartDocsRecordAppmaps.command);
              }
              break;
            case 'copyInstallCommand':
              Telemetry.sendEvent(COPY_INSTALL_COMMAND, {
                rootDirectory,
              });
              break;
            default:
              break;
          }
        });

        vscode.commands.executeCommand('appmap.focusQuickstartDocs', 1);
      })
    );
  }
}

function getWebviewContent(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  rootDirectory?: string
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.js'))
  );
  const nonce = getNonce();
  const pathString = rootDirectory
    ? `"${path.resolve(rootDirectory).replace(/\\/g, '\\\\')}"`
    : 'undefined';

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
      AppLandWeb.mountQuickstartInstallAgent(${pathString});
    </script>
  </body>
  </html>`;
}
