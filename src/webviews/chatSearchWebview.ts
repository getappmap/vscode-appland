import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import appmapMessageHandler from './appmapMessageHandler';
import FilterStore, { SavedFilter } from './filterStore';
import WebviewList from './WebviewList';
import selectIndexProcess, { IndexProcess, ReasonCode } from '../lib/selectIndexProcess';
import { RecordAppMaps } from '../tree/instructionsTreeDataProvider';
import { getApiKey } from '../authentication';
import ExtensionSettings from '../configuration/extensionSettings';
import { CodeSelection } from '../commands/quickSearch';
import ExtensionState from '../configuration/extensionState';

export default class ChatSearchWebview {
  private webviewList = new WebviewList();
  private filterStore: FilterStore;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState
  ) {
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

  async explain(workspace?: vscode.WorkspaceFolder, codeSelection?: CodeSelection) {
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

    const { rpcPort: appmapRpcPort, configFolder } = selectedWatcher;

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

    let workspaceFolder = workspace;
    if (!workspaceFolder) {
      const uri = vscode.Uri.from({ scheme: 'file', path: configFolder });
      workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    }

    if (workspaceFolder) this.extensionState.setWorkspaceOpenedNavie(workspaceFolder, true);

    panel.webview.onDidReceiveMessage(appmapMessageHandler(this.filterStore, workspace));
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'chat-search-ready':
          panel.webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            codeSelection,
            savedFilters: this.filterStore.getSavedFilters(),
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
          });
          break;
        case 'open-record-instructions':
          await vscode.commands.executeCommand('appmap.openInstallGuide', RecordAppMaps);
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

  public static register(
    context: vscode.ExtensionContext,
    extensionState: ExtensionState
  ): ChatSearchWebview {
    return new ChatSearchWebview(context, extensionState);
  }
}
