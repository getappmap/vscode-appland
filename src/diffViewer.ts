import * as vscode from 'vscode';
import { getNonce } from './util';
import { join } from 'path';

export default function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand(
    'appmap.diff',
    (baseUri: vscode.Uri, workingUri: vscode.Uri) => {
      const panel = vscode.window.createWebviewPanel(
        'appmap.views.diff',
        'AppMap Diff',
        vscode.ViewColumn.One,
        {}
      );

      const nonce = getNonce();
      const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.file(join(context.extensionPath, 'out', 'app.js'))
      );

      console.log(panel.webview.cspSource);

      panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">

          <!--
          Use a content security policy to only allow loading images from https or from our extension directory,
          and only allow scripts that have a specific nonce.
          -->
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} 'self' data: ; style-src 'unsafe-inline' ${panel.webview.cspSource}; script-src 'nonce-${nonce}';">

          <meta name="viewport" content="width=device-width, initial-scale=1.0">

          <title>AppLand Scenario</title>
        </head>
        <body>
          <div id="app">
          </div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
          <script type="text/javascript" nonce="${nonce}">
            AppLandWeb.mountDiff();
          </script>
        </body>
        </html>`;
    }
  );
  context.subscriptions.push(cmd);
}
