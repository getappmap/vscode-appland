import path from 'path';
import * as vscode from 'vscode';

type AppmapModule =
  | 'app'
  | 'install-guide'
  | 'chat-search'
  | 'findings-view'
  | 'finding-info-view'
  | 'sign-in-view';

type getWebviewContentOptions = {
  htmlStyle?: string;
  rpcPort?: number;
  connectSrc?: string[];
};

export default function getWebviewContent(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  title: string,
  appmapModule: AppmapModule,
  options: getWebviewContentOptions = {}
): string {
  const { htmlStyle, rpcPort } = options;

  const scriptUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.js'))
  );

  const cssUri = webview.asWebviewUri(
    vscode.Uri.file(path.join(context.extensionPath, 'out', 'app.css'))
  );

  const connectSrc = options.connectSrc ?? [];
  if (rpcPort) connectSrc.push(`http://localhost:${rpcPort}`, `ws://localhost:${rpcPort}`);

  return ` <!DOCTYPE html>
  <html style="${htmlStyle ?? ''}" lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="
      default-src 'none';
      connect-src ${connectSrc.join(' ').trim()};
      img-src ${webview.cspSource} data: blob:;
      script-src ${webview.cspSource} 'unsafe-eval';
      style-src ${webview.cspSource} 'unsafe-inline';
    ">
    <link href="${cssUri}" rel="stylesheet">

    <title>${title}</title>
  </head>
  <body data-appmap-module="${appmapModule}" style="padding:0;">
    <script src="${scriptUri}"></script>
  </body>
  </html>`;
}
