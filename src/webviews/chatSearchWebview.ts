import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import { workspaceServices } from '../services/workspaceServices';
import { NodeProcessService } from '../services/nodeProcessService';
import { warn } from 'console';
import IndexProcessWatcher from '../services/indexProcessWatcher';
import { ProcessId } from '../services/processWatcher';
import appmapMessageHandler from './appmapMessageHandler';
import FilterStore, { SavedFilter } from './filterStore';
import WebviewList from './WebviewList';

export default class ChatSearchWebview {
  private webviewList = new WebviewList();
  private filterStore: FilterStore;

  private constructor(private readonly context: vscode.ExtensionContext) {
    this.filterStore = new FilterStore(context);
    this.filterStore.onDidChangeFilters((event) => {
      this.updateFilters(event.savedFilters);
    });
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.explain', this.explain.bind(this))
    );
  }

  get currentWebview(): vscode.Webview | undefined {
    return this.webviewList.currentWebview;
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
    this.webviewList.enroll(panel);

    panel.webview.html = getWebviewContent(
      panel.webview,
      this.context,
      'AppMap AI: Explain',
      'chat-search'
    );

    panel.webview.onDidReceiveMessage(appmapMessageHandler(this.filterStore, workspace));
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'chat-search-ready':
          panel.webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            question,
            savedFilters: this.filterStore.getSavedFilters(),
          });
          break;
      }
    });
  }

  updateFilters(savedFilters: SavedFilter[]) {
    this.webviewList.webviews.forEach((webview) => {
      webview.postMessage({
        type: 'updateSavedFilters',
        savedFilters,
      });
    });
  }

  public static register(context: vscode.ExtensionContext): ChatSearchWebview {
    return new ChatSearchWebview(context);
  }
}
