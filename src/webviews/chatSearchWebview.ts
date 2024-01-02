import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import { workspaceServices } from '../services/workspaceServices';
import { NodeProcessService } from '../services/nodeProcessService';
import { warn } from 'console';
import IndexProcessWatcher from '../services/indexProcessWatcher';
import { ProcessId } from '../services/processWatcher';
import viewSource from './viewSource';
import { Telemetry } from '../telemetry';
import { getApiKey } from '../authentication';
import ExtensionSettings from '../configuration/extensionSettings';

export default class ChatSearchWebview {
  public readonly panels = new Set<vscode.WebviewPanel>();

  private constructor(private readonly context: vscode.ExtensionContext) {
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.explain', this.explain.bind(this))
    );
  }

  readyIndexProcess(workspace: vscode.WorkspaceFolder): IndexProcessWatcher | undefined {
    const processServiceInstance = workspaceServices().getServiceInstanceFromClass(
      NodeProcessService,
      workspace
    );
    if (!processServiceInstance) return;

    const indexProcess = processServiceInstance.processes.find(
      (proc) => proc.id === ProcessId.Index
    ) as IndexProcessWatcher;
    if (!indexProcess) {
      warn(`No ${ProcessId.Index} helper process found for workspace: ${workspace.name}`);
      return;
    }

    if (!indexProcess.isRpcAvailable()) return;

    return indexProcess;
  }

  isReady(workspace: vscode.WorkspaceFolder): boolean {
    return !!this.readyIndexProcess(workspace);
  }

  async explain(workspace?: vscode.WorkspaceFolder, question?: string) {
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

    const indexProcess = this.readyIndexProcess(workspace);
    if (!indexProcess)
      return showError('AppMap Explain is not ready yet. Please try again in a few seconds.');

    const { rpcPort: appmapRpcPort } = indexProcess;

    const panel = vscode.window.createWebviewPanel(
      'chatSearch',
      'AppMap AI: Explain',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    this.panels.add(panel);
    panel.onDidDispose(() => this.panels.delete(panel));

    panel.webview.html = getWebviewContent(
      panel.webview,
      this.context,
      'AppMap AI: Explain',
      'chat-search'
    );

    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'chat-search-ready':
          panel.webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            question,
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
          });

          break;
        case 'viewSource':
          viewSource(message.text, workspace);
          break;
        case 'reportError':
          Telemetry.reportWebviewError(message.error);
          break;
        case 'appmapOpenUrl':
          vscode.env.openExternal(message.url);
          break;
        case 'copyToClipboard':
          vscode.env.clipboard.writeText(message.stringToCopy);
          break;
      }
    });
  }

  public static register(context: vscode.ExtensionContext): ChatSearchWebview {
    return new ChatSearchWebview(context);
  }
}
