import path from 'path';
import * as vscode from 'vscode';

type AppmapModule =
  | 'app'
  | 'install-guide'
  | 'findings-view'
  | 'finding-info-view'
  | 'sign-in-view';

export default function getWebviewContent(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  title: string,
  appmapModule: AppmapModule,
  htmlStyle = ''
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.js'))
  );

  const cssUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.css'))
  );

  return ` <!DOCTYPE html>
  <html style="${htmlStyle}" lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${cssUri}" rel="stylesheet">

    <title>${title}</title>
  </head>
  <body data-appmap-module="${appmapModule}">
    <script src="${scriptUri}"></script>
  </body>
  </html>`;
}
