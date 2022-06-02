import { PathLike } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import AppMapCollectionFile from '../services/appmapCollectionFile';
import { getNonce } from '../util';
import { OPEN_VIEW, Telemetry } from '../telemetry';

interface AppMapListItem {
  path: PathLike;
  name?: string;
  requests?: number;
  sqlQueries?: number;
  functions?: number;
}

function getBestAppMaps(appmaps: AppMapCollectionFile, maxCount = 10): AppMapListItem[] {
  return appmaps
    .allAppMaps()
    .map(({ descriptor }) => ({
      path: descriptor.resourceUri.fsPath,
      name: descriptor.metadata?.name as string,
      requests: descriptor.numRequests as number,
      sqlQueries: descriptor.numQueries as number,
      functions: descriptor.numFunctions as number,
    }))
    .sort((a, b) => {
      const scoreA = a.requests * 100 + a.sqlQueries * 100 + a.functions * 100;
      const scoreB = b.requests * 100 + b.sqlQueries * 100 + b.functions * 100;
      return scoreB - scoreA;
    })
    .slice(0, maxCount);
}

export default class OpenAppMapsWebview {
  public static readonly viewType = 'appmap.views.openAppMaps';
  public static readonly command = 'appmap.openOpenAppmaps';

  // Keyed by project root directory
  private static existingPanel?: vscode.WebviewPanel;

  public static register(
    context: vscode.ExtensionContext,
    appmapCollection: AppMapCollectionFile
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, () => {
        // Attempt to re-use an existing webview for this project if one exists
        if (OpenAppMapsWebview.existingPanel) {
          OpenAppMapsWebview.existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Open AppMaps',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        OpenAppMapsWebview.existingPanel = panel;

        // If the user closes the panel, make sure it's no longer cached
        panel.onDidDispose(() => {
          OpenAppMapsWebview.existingPanel = undefined;
        });

        panel.webview.html = getWebviewContent(panel.webview, context);

        const eventListener = appmapCollection.onUpdated(() => {
          panel.webview.postMessage({
            type: 'appmapSnapshot',
            appmaps: getBestAppMaps(appmapCollection),
          });
        });

        panel.onDidDispose(() => {
          eventListener.dispose();
        });

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'preInitialize':
              // The webview has been created but may not be ready to receive all messages yet.
              panel.webview.postMessage({
                type: 'init',
                appmaps: getBestAppMaps(appmapCollection),
              });
              break;

            case 'openFile':
              vscode.commands.executeCommand('vscode.open', vscode.Uri.file(message.file));
              break;

            case 'openProjectPicker':
              vscode.commands.executeCommand('appmap.openWorkspaceOverview');
              break;

            case 'clickLink':
              Telemetry.reportOpenUri(message.uri);
              break;

            case 'postInitialize':
              Telemetry.sendEvent(OPEN_VIEW, { viewId: this.viewType });
              break;

            default:
              break;
          }
        });

        vscode.commands.executeCommand('appmap.view.focusInstructions', 3);
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
      AppLandWeb.mountOpenAppmaps();
    </script>1
  </body>
  </html>`;
}
