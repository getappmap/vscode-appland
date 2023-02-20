import * as vscode from 'vscode';
import SignInManager from '../services/signInManager';
import getWebviewContent from './getWebviewContent';

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
      'sign-in-view'
    );

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
}
