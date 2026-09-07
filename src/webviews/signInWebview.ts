import * as vscode from 'vscode';
import SignInManager from '../services/signInManager';
import getWebviewContent from './getWebviewContent';
import AppMapServerAuthenticationProvider from '../authentication/appmapServerAuthenticationProvider';
import ExtensionSettings from '../configuration/extensionSettings';
import type { SetConfigurationUrlOutcome } from '../commands/setConfigurationUrl';

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
            enableOrgConfig: true,
            // Deliberately constant: this suppresses the webview's "apply your
            // organization's configuration" link, and nothing the extension can read back
            // means the configuration a user is being onboarded onto is the one in force. A
            // configuration URL can be stale, rotated or unreachable and is still a URL, and
            // a configuration applied in the past may have been superseded. Re-applying is
            // near enough a no-op, so the link is always offered; only an apply performed in
            // this session is confirmed, from what the command reports below.
            orgConfigApplied: false,
          });
          break;
        }

        case 'apply-org-config': {
          try {
            // Confirmation is for the apply the user just performed, so it follows what the
            // command did rather than the state left behind — a local file applies a
            // configuration without setting any URL, and a dismissed command leaves an
            // already-active configuration in place without having applied anything.
            const outcome = await vscode.commands.executeCommand<SetConfigurationUrlOutcome>(
              'appmap.setConfigurationUrl'
            );
            webviewView.webview.postMessage({
              type: 'apply-org-config',
              applied: outcome === 'applied',
            });
          } catch (e) {
            webviewView.webview.postMessage({
              type: 'apply-org-config',
              error: e instanceof Error ? e.message : String(e),
            });
          }
          break;
        }

        case 'sign-in': {
          const ssoTarget = message.data;
          this.authProvider.cancel();
          // AHT: If there is a sign-in attempt in progress it does not get cancelled before the next sign-in attempt
          // unless I delay the next attempt using setTimeout. Perhaps there is a race condition in VS Code.
          setTimeout(() => SignInManager.signIn(ssoTarget), 500);
          break;
        }

        case 'activate': {
          const apiKey = message.data;
          this.authProvider.cancel();
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
