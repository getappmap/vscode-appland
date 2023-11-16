import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import { getApiKey } from '../authentication';

export default class AiHelpWebview {
  public static viewType = 'appmap.openAiHelp';
  private static existingPanel?: vscode.WebviewPanel;

  public static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.openAiHelp', async () => {
        // Attempt to re-use an existing webview for this project if one exists
        if (this.existingPanel) {
          this.existingPanel.reveal(vscode.ViewColumn.One);
          return;
        }

        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'Ask AppMap AI',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.existingPanel = panel;
        panel.webview.html = getWebviewContent(
          panel.webview,
          context,
          'Ask AppMap AI',
          'chat-help',
          { htmlStyle: 'height: 100%; width: 100%;' }
        );

        panel.onDidDispose(() => {
          this.existingPanel = undefined;
        });

        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.command) {
            case 'ready': {
              console.log('got ready message');
              panel.webview.postMessage({
                type: 'init',
                apiKey: await getApiKey(false),
              });
              break;
            }

            default: {
              // nop
            }
          }
        });
      })
    );
  }
}
