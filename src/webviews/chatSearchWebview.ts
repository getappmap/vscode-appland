import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import appmapMessageHandler from './appmapMessageHandler';
import FilterStore, { SavedFilter } from './filterStore';
import WebviewList from './WebviewList';
import { ProjectPicker, RecordAppMaps } from '../tree/instructionsTreeDataProvider';
import { getApiKey } from '../authentication';
import ExtensionSettings from '../configuration/extensionSettings';
import { CodeSelection } from '../commands/quickSearch';
import ExtensionState from '../configuration/extensionState';
import AppMapCollection from '../services/appmapCollection';
import RpcProcessService from '../services/rpcProcessService';
import { NodeProcessService } from '../services/nodeProcessService';
import CommandRegistry from '../commands/commandRegistry';

type ExplainOpts = {
  workspace?: vscode.WorkspaceFolder;
  codeSelection?: CodeSelection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetAppmap?: any;
  targetAppmapFsPath?: string;
};

export default class ChatSearchWebview {
  private webviewList = new WebviewList();
  private filterStore: FilterStore;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState,
    private readonly appmaps: AppMapCollection,
    private readonly rpcService: RpcProcessService
  ) {
    this.filterStore = new FilterStore(context);
    this.filterStore.onDidChangeFilters((event) => {
      this.updateFilters(event.savedFilters);
    });
    context.subscriptions.push(
      CommandRegistry.registerCommand('appmap.explain.impl', this.explain.bind(this))
    );
  }

  get currentWebview(): vscode.Webview | undefined {
    return this.webviewList.currentWebview;
  }

  async explain({ workspace, codeSelection, targetAppmap, targetAppmapFsPath }: ExplainOpts = {}) {
    const appmapRpcPort = await this.rpcService.port();
    if (!appmapRpcPort) {
      const optionViewLog = 'View output log';
      const res = await vscode.window.showErrorMessage(
        'The AppMap RPC server was unable to start. Please check the output log for more information.',
        optionViewLog,
        'Cancel'
      );
      if (res === optionViewLog) {
        NodeProcessService.outputChannel.show();
      }
      return;
    }

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

    vscode.workspace.workspaceFolders?.forEach((workspaceFolder) => {
      this.extensionState.setWorkspaceOpenedNavie(workspaceFolder, true);
    });

    const getLatestAppMaps = (count = 10): Array<{ [key: string]: unknown }> => {
      return this.appmaps
        .allAppMaps()
        .sort((a, b) => b.descriptor.timestamp - a.descriptor.timestamp)
        .slice(0, count)
        .map((appmap) => ({
          name: appmap.descriptor.metadata?.name,
          recordingMethod: appmap.descriptor.metadata?.recorder?.type,
          createdAt: new Date(appmap.descriptor.timestamp).toISOString(),
          path: appmap.descriptor.resourceUri.fsPath,
        }));
    };
    let mostRecentAppMaps = getLatestAppMaps();

    this.context.subscriptions.push(
      this.appmaps.onUpdated(() => {
        mostRecentAppMaps = getLatestAppMaps();
        panel.webview.postMessage({
          type: 'update',
          mostRecentAppMaps,
        });
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
            appmapYmlPresent: true, // Note that at the moment this is always true
            mostRecentAppMaps,
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
            targetAppmap,
            targetAppmapFsPath,
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
    appmaps: AppMapCollection,
    rpcService: RpcProcessService
  ): ChatSearchWebview {
    return new ChatSearchWebview(context, extensionState, appmaps, rpcService);
  }
}
