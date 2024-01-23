import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import appmapMessageHandler from './appmapMessageHandler';
import FilterStore, { SavedFilter } from './filterStore';
import WebviewList from './WebviewList';
import selectIndexProcess, { IndexProcess, ReasonCode } from '../lib/selectIndexProcess';

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

  async explain(workspace?: vscode.WorkspaceFolder, question?: string) {
    const selectIndexProcessResult = await selectIndexProcess(workspace);
    if (!selectIndexProcessResult) return;

    let selectedWatcher: IndexProcess | undefined;
    switch (selectIndexProcessResult) {
      case ReasonCode.NoIndexProcessWatchers:
        vscode.window.showInformationMessage(
          `${workspace?.name || 'Your workspace'} does not have AppMaps`
        );
        break;
      case ReasonCode.NoReadyIndexProcessWatchers:
        vscode.window.showInformationMessage(
          `AppMap AI is not ready yet. Please try again in a few seconds.`
        );
        break;
      case ReasonCode.NoSelectionMade:
        break;
      default:
        selectedWatcher = selectIndexProcessResult;
        break;
    }
    if (!selectedWatcher) return;

    const { rpcPort: appmapRpcPort } = selectedWatcher;

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
      'chat-search',
      { rpcPort: appmapRpcPort }
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
