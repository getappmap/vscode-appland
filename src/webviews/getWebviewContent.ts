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
  appmapModule: AppmapModule
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.js'))
  );

  return ` <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      img-src ${webview.cspSource} data:;
      script-src ${webview.cspSource};
      style-src 'unsafe-inline';
    ">

    <title>${title}</title>
  </head>
  <body data-appmap-module="${appmapModule}">
    <script src="${scriptUri}"></script>
  </body>
  </html>`;
}
