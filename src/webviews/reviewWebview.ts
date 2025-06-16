import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import WebviewList from './WebviewList';
import type RpcProcessService from '../services/rpcProcessService';
import AnalysisManager from '../services/analysisManager';
import { bestFilePath } from '../lib/bestFilePath';

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

        function updateFindings() {
          panel.webview.postMessage({
            type: 'update-findings',
            findings: AnalysisManager?.findingsIndex?.findings() ?? [],
          });
        }

        context.subscriptions.push(
          AnalysisManager.onAnalysisToggled(() => {
            updateFindings();
          })
        );

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async (message) => {
          switch (message.type) {
            case 'ready': {
              panel.webview.postMessage({
                type: 'init',
                findings: AnalysisManager?.findingsIndex?.findings() ?? [],
                rpcPort,
                ...options,
              });
              break;
            }
            case 'error': {
              vscode.window.showErrorMessage(message.error);
              break;
            }
            case 'open-file': {
              const { path } = message;
              const bestPath = await bestFilePath(path.replace(/:\d+$/, ''));
              if (bestPath) {
                vscode.commands.executeCommand('vscode.open', bestPath);
              }
              break;
            }
            case 'open-appmap-finding': {
              const { path, findingHash } = message;
              const state = JSON.stringify({ selectedObject: `analysis-finding:${findingHash}` });
              const uri = vscode.Uri.file(path);
              vscode.commands.executeCommand('vscode.open', uri.with({ fragment: state }));
              break;
            }
            case 'open-navie-thread': {
              const { threadId } = message;
              await vscode.commands.executeCommand('appmap.explain', { threadId });
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
