import * as vscode from 'vscode';
import SignInManager from '../services/signInManager';
import getWebviewContent from './getWebviewContent';
import AppMapServerAuthenticationProvider from '../authentication/appmapServerAuthenticationProvider';
import ExtensionSettings from '../configuration/extensionSettings';

export default class SignInViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'appmap.views.signIn';
  private _view?: vscode.WebviewView;

  constructor(
    private context: vscode.ExtensionContext,
    private authProvider: AppMapServerAuthenticationProvider
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const appmapServerUrl = ExtensionSettings.appMapServerURL.toString();

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.context,
      'Sign in',
      'sign-in-view',
      {
        htmlStyle: 'height: 100%; margin: 0; overflow-y: hidden;',
        connectSrc: [appmapServerUrl],
      }
    );

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sign-in-ready': {
          webviewView.webview.postMessage({
            type: 'init-sign-in',
            appmapServerUrl,
          });
          break;
        }

        case 'sign-in': {
          const ssoTarget = message.data;
          this.authProvider.customCancellationToken.cancel();
          // AHT: If there is a sign-in attempt in progress it does not get cancelled before the next sign-in attempt
          // unless I delay the next attempt using setTimeout. Perhaps there is a race condition in VS Code.
          setTimeout(() => SignInManager.signIn(ssoTarget), 500);
          break;
        }

        case 'activate': {
          const apiKey = message.data;
          this.authProvider.customCancellationToken.cancel();
          // If the license key is coming from the webview we have already validated it
          await this.authProvider.enterLicenseKeyCommand(apiKey, true);
          break;
        }

        case 'click-sign-in-link': {
          break;
        }

        default:
          break;
      }
    });
  }
}
