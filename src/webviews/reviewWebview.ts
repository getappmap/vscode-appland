import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import type RpcProcessService from '../services/rpcProcessService';
import openLocation from '../lib/openLocation';

type ReviewWebviewOptions = {
  baseRef?: string;
};

export default class ReviewWebview {
  private static readonly viewType = 'appmap.views.review';
  public static readonly command = 'appmap.openReview';

  static registered = false;

  public static register(context: vscode.ExtensionContext, rpc: RpcProcessService): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(this.command, async (options: ReviewWebviewOptions) => {
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

        // Set webview content
        const rpcPort = rpc.port();
        panel.webview.html = getWebviewContent(panel.webview, context, 'AppMap Review', 'review', {
          rpcPort,
        });
        panel.webview.onDidReceiveMessage((message) => {
          console.debug('Received message in review webview:', message);
          if (message === 'ready') {
            panel.webview.postMessage({ type: 'init', rpcPort, ...options });
          } else if (Array.isArray(message)) {
            const [command, ...args] = message;
            if (command === 'open-location') {
              const [location] = args;
              return openLocation(location);
            } else if (command === 'show-navie-thread') {
              const [threadId] = args;
              vscode.commands.executeCommand('appmap.explain', { threadId });
            } else if (command === 'view-recording-instructions') {
              vscode.commands.executeCommand('appmap.openInstallGuide');
            }
          }
          console.warn('Unknown message received in review webview', message);
        });
      })
    );

    this.registered = true;
    this.runPending();
  }

  static pending: [ReviewWebviewOptions, () => void, () => void][] = [];

  private static runPending() {
    if (!this.registered) {
      return;
    }

    const pending = this.pending;
    this.pending = [];
    for (const [options, resolve, reject] of pending) {
      vscode.commands.executeCommand(this.command, options).then(resolve, reject);
    }
  }

  public static async open(options: ReviewWebviewOptions = {}): Promise<void> {
    if (this.registered) {
      return vscode.commands.executeCommand(this.command, options);
    } else {
      return new Promise<void>((resolve, reject) => {
        this.pending.push([options, resolve, reject]);
      });
    }
  }
}
