import path from 'path';
import * as vscode from 'vscode';
import SignInManager from '../services/signInManager';
import { getNonce } from '../util';

export default class SignInViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'appmap.views.signIn';
  private _view?: vscode.WebviewView;
  private _extensionUri?: vscode.Uri;
  private _extensionPath: string;

  constructor(context: vscode.ExtensionContext) {
    this._extensionUri = context.extensionUri;
    this._extensionPath = context.extensionPath;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext<unknown>,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = this.getWebviewContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sign-in': {
          SignInManager.signIn();
          break;
        }

        default:
          break;
      }
    });
  }

  getWebviewContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this._extensionPath, 'out', 'app.js'))
    );
    const nonce = getNonce();

    return ` <!DOCTYPE html>
  <html lang="en" style="height:100%;margin:0;overflow-y:hidden">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>AppLand Scenario</title>
  </head>
  <body style="height:100%;margin:0;overflow-y:hidden">
    <div id="app">
    </div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
    <script type="text/javascript" nonce="${nonce}">
      AppLandWeb.mountSignInView();
    </script>
  </body>
  </html>`;
  }
}
