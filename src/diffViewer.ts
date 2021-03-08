import * as vscode from 'vscode';
import { getNonce } from './util';
import { join } from 'path';

export default function activate(context: vscode.ExtensionContext): void {
  const cmd = vscode.commands.registerCommand(
    'appmap.diff',
    async (baseUri: vscode.Uri, workingUri: vscode.Uri) => {
      console.log(baseUri, workingUri);
      const panel = vscode.window.createWebviewPanel(
        'appmap.views.diff',
        'AppMap Diff',
        vscode.ViewColumn.One,
        { enableScripts: true }
      );

      const nonce = getNonce();
      const scriptUri = panel.webview.asWebviewUri(
        vscode.Uri.file(join(context.extensionPath, 'out', 'app.js'))
      );

      panel.webview.html = `
        <!DOCTYPE html>
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
            AppLandWeb.mountDiff();
          </script>
        </body>
        </html>`;

      const base = await vscode.workspace.openTextDocument(baseUri);
      const working = await vscode.workspace.openTextDocument(workingUri);

      panel.webview.postMessage({
        type: 'update',
        base: base.getText(),
        working: working.getText(),
      });
    }
  );
  context.subscriptions.push(cmd);
}
