import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import WebviewList from './WebviewList';
import type RpcProcessService from '../services/rpcProcessService';

export default class ReviewWebview {
  private static readonly viewType = 'appmap.views.review';
  public static readonly command = 'appmap.openReview';
  private static webviewList = new WebviewList();

  public static register(context: vscode.ExtensionContext, rpc: RpcProcessService): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, async (options) => {
        // Create and show panel
        const panel = vscode.window.createWebviewPanel(
          this.viewType,
          'AppMap Review',
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            retainContextWhenHidden: true,
          }
        );

        this.webviewList.enroll(panel);

        // Set webview content
        const rpcPort = rpc.port();
        panel.webview.html = getWebviewContent(panel.webview, context, 'AppMap Review', 'review', {
          rpcPort,
        });
        panel.webview.postMessage({ type: 'init', rpcPort, ...options });

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.type) {
            case 'ready': {
              // Initialize the webview with any necessary data
              panel.webview.postMessage({
                type: 'initialize',
                data: {
                  // Add any initialization data needed by VReview component
                },
              });
              break;
            }
            case 'error': {
              vscode.window.showErrorMessage(message.error);
              break;
            }
            default: {
              console.warn(`Unhandled message type: ${message.type}`);
            }
          }
        });

        // Update content when the panel becomes visible
        panel.onDidChangeViewState(() => {
          if (panel.visible) {
            panel.webview.postMessage({
              type: 'activate',
              data: {
                // Add any data needed when panel becomes visible
              },
            });
          }
        });

        // Cleanup when the panel is closed
        panel.onDidDispose(() => {
          // Add any cleanup code here
        });
      })
    );
  }
}
