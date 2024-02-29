import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import appmapMessageHandler from './appmapMessageHandler';
import FilterStore, { SavedFilter } from './filterStore';
import WebviewList from './WebviewList';
import selectIndexProcess, { IndexProcess, ReasonCode } from '../lib/selectIndexProcess';
import { ProjectPicker, RecordAppMaps } from '../tree/instructionsTreeDataProvider';
import { getApiKey } from '../authentication';
import ExtensionSettings from '../configuration/extensionSettings';
import { CodeSelection } from '../commands/quickSearch';
import ExtensionState from '../configuration/extensionState';
import AppMapCollection from '../services/appmapCollection';

export default class ChatSearchWebview {
  private webviewList = new WebviewList();
  private filterStore: FilterStore;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState,
    private readonly appmaps: AppMapCollection
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

    const getLatestAppMaps = (
      workspaceFolder: vscode.WorkspaceFolder,
      count = 10
    ): Array<{ [key: string]: unknown }> => {
      return this.appmaps
        .allAppMapsForWorkspaceFolder(workspaceFolder)
        .sort((a, b) => b.descriptor.timestamp - a.descriptor.timestamp)
        .slice(0, count)
        .map((appmap) => ({
          name: appmap.descriptor.metadata?.name,
          recordingMethod: appmap.descriptor.metadata?.recorder?.type,
          createdAt: new Date(appmap.descriptor.timestamp).toISOString(),
          path: appmap.descriptor.resourceUri.fsPath,
        }));
    };
    let appmaps: Array<{ [key: string]: unknown }> = [];
    if (workspaceFolder) {
      this.extensionState.setWorkspaceOpenedNavie(workspaceFolder, true);
      appmaps = getLatestAppMaps(workspaceFolder);
    }

    this.context.subscriptions.push(
      this.appmaps.onUpdated((updatedWorkspaceFolder) => {
        console.log(updatedWorkspaceFolder?.name);
        if (workspaceFolder && updatedWorkspaceFolder === workspaceFolder) {
          appmaps = getLatestAppMaps(workspaceFolder);
          panel.webview.postMessage({
            type: 'update',
            appmaps,
          });
        }
      })
    );

    panel.webview.onDidReceiveMessage(appmapMessageHandler(this.filterStore, workspace));
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'chat-search-ready':
          panel.webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            codeSelection,
            savedFilters: this.filterStore.getSavedFilters(),
            appmapYmlPresent: !!selectedWatcher, // Note that at the moment this is always true
            appmaps,
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
          });
          break;
        case 'open-record-instructions':
          await vscode.commands.executeCommand('appmap.openInstallGuide', RecordAppMaps);
          break;
        case 'open-install-instructions':
          await vscode.commands.executeCommand('appmap.openInstallGuide', ProjectPicker);
          break;
        case 'open-appmap': {
          const uri = vscode.Uri.file(message.path);
          await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');
          break;
        }

        case 'show-appmap-tree':
          await vscode.commands.executeCommand('appmap.views.appmaps.focus');
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
    extensionState: ExtensionState,
    appmaps: AppMapCollection
  ): ChatSearchWebview {
    return new ChatSearchWebview(context, extensionState, appmaps);
  }
}
