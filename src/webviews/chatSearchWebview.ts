import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import { workspaceServices } from '../services/workspaceServices';
import { NodeProcessService } from '../services/nodeProcessService';
import { warn } from 'console';
import IndexProcessWatcher from '../services/indexProcessWatcher';
import { ProcessId } from '../services/processWatcher';

export default class ChatSearchWebview {
  public static register(context: vscode.ExtensionContext): void {
    let aiPort: number | undefined;

    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.search',
        async (workspace?: vscode.WorkspaceFolder, question?: string) => {
          if (!workspace) {
            const workspaces = vscode.workspace.workspaceFolders;
            if (!workspaces) return;

            if (workspaces.length === 1) {
              workspace = workspaces[0];
            } else {
              workspace = await vscode.window.showWorkspaceFolderPick({
                placeHolder: 'Select a workspace folder',
              });
            }
            if (!workspace) return;
          }

          const showError = async (message: string): Promise<string | undefined> => {
            return vscode.window.showErrorMessage(message);
          };

          const showAppMapSearchNotReadyError = async (): Promise<string | undefined> => {
            return showError('AppMap search is not ready yet. Please try again in a few seconds.');
          };

          const processServiceInstance = workspaceServices().getServiceInstanceFromClass(
            NodeProcessService,
            workspace
          );
          if (!processServiceInstance) {
            warn(`No NodeProcessService instance found for workspace: ${workspace.name}`);
            return showAppMapSearchNotReadyError();
          }

          const indexProcess = processServiceInstance.processes.find(
            (proc) => proc.id === ProcessId.Index
          ) as IndexProcessWatcher;
          if (!indexProcess) {
            warn(`No ${ProcessId.Index} helper process found for workspace: ${workspace.name}`);
            return showAppMapSearchNotReadyError();
          }

          if (!indexProcess.isRpcAvailable()) {
            return showAppMapSearchNotReadyError();
          }

          const { rpcPort: indexPort } = indexProcess;

          if (!aiPort) {
            const aiPortStr = await vscode.window.showInputBox({
              title: 'AI RPC port (default: 30102)',
            });
            if (aiPortStr) aiPort = parseInt(aiPortStr, 10);
          }

          const panel = vscode.window.createWebviewPanel(
            'chatSearch',
            'Chat Search',
            vscode.ViewColumn.One,
            {
              enableScripts: true,
              retainContextWhenHidden: true,
            }
          );

          panel.webview.html = getWebviewContent(
            panel.webview,
            context,
            'Chat Search',
            'chat-search'
          );

          panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
              case 'chat-search-ready':
                panel.webview.postMessage({
                  type: 'initChatSearch',
                  indexPort: indexPort,
                  aiPort: aiPort,
                  question,
                });

                break;
            }
          });
        }
      )
    );
  }
}
