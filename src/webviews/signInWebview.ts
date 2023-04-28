import * as vscode from 'vscode';
import SignInManager from '../services/signInManager';
import getWebviewContent from './getWebviewContent';
import { CLICKED_SIGN_IN_LINK, Telemetry } from '../telemetry';

export default class SignInViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'appmap.views.signIn';
  private _view?: vscode.WebviewView;

  constructor(private context: vscode.ExtensionContext) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.context,
      'Sign in',
      'sign-in-view',
      'height: 100%; margin: 0; overflow-y: hidden;'
    );

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'sign-in': {
          SignInManager.signIn();
          break;
        }

        case 'click-sign-in-link': {
          const linkType = message.data as string;
          Telemetry.sendEvent(CLICKED_SIGN_IN_LINK, { linkType });
          break;
        }

        default:
          break;
      }
    });
  }
}
