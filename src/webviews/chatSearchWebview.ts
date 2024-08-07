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
import ChatSearchDataService, { LatestAppMap } from '../services/chatSearchDataService';
import { parseLocation } from '../util';
import { proxySettings } from '../lib/proxySettings';

type ExplainOpts = {
  workspace?: vscode.WorkspaceFolder;
  codeSelection?: CodeSelection;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetAppmap?: any;
  targetAppmapFsPath?: string;
  suggestion?: { label: string; prompt: string };
};

export enum ExplainResponseStatus {
  NoAppMapRpcPort,
  Success,
}

export type ExplainResponse = {
  status: ExplainResponseStatus;
  codeSelection?: CodeSelection;
};

export default class ChatSearchWebview {
  private webviewList = new WebviewList();
  private filterStore: FilterStore;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState,
    private readonly dataService: ChatSearchDataService
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

  async explain({
    workspace,
    codeSelection,
    targetAppmap,
    targetAppmapFsPath,
    suggestion,
  }: ExplainOpts = {}): Promise<ExplainResponse> {
    const appmapRpcPort = this.dataService.appmapRpcPort;
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
      return { status: ExplainResponseStatus.NoAppMapRpcPort };
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

    this.context.subscriptions.push(
      this.dataService.onAppMapsUpdated((appmaps: LatestAppMap[]) => {
        panel.webview.postMessage({
          type: 'update',
          mostRecentAppMaps: appmaps,
        });
      })
    );

    const mostRecentAppMaps = this.dataService.latestAppMaps();
    codeSelection ||= await this.dataService.codeSelection();

    panel.webview.onDidReceiveMessage(appmapMessageHandler(this.filterStore, workspace));
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'chat-search-ready':
          panel.webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            codeSelection,
            proxySettings: proxySettings(),
            savedFilters: this.filterStore.getSavedFilters(),
            appmapYmlPresent: true, // Note that at the moment this is always true
            mostRecentAppMaps,
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
            targetAppmap,
            targetAppmapFsPath,
            suggestion,
          });
          break;
        case 'open-new-chat':
          void vscode.commands.executeCommand('appmap.explain');
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
        case 'open-location': {
          const { location, directory } = message;
          const result = await parseLocation(location, directory);

          if (result instanceof vscode.Uri) {
            await vscode.commands.executeCommand('vscode.open', result);
          } else {
            if (result.uri.fsPath.endsWith('.appmap.json')) {
              // Open an AppMap
              // The range will actually be an event id
              // This means we'll need to add 1 to the (zero-based) line number
              const viewState = {
                currentView: 'viewSequence',
                selectedObject: `event:${result.range.start.line + 1}`,
              };
              await vscode.commands.executeCommand(
                'vscode.open',
                result.uri.with({ fragment: JSON.stringify(viewState) })
              );
            } else {
              // Open a text document
              await vscode.commands.executeCommand('vscode.open', result.uri);
              const { activeTextEditor } = vscode.window;
              if (activeTextEditor) {
                activeTextEditor.revealRange(result.range, vscode.TextEditorRevealType.InCenter);
              }
            }
          }

          break;
        }

        case 'show-appmap-tree':
          await vscode.commands.executeCommand('appmap.views.appmaps.focus');
          break;

        case 'select-llm-option': {
          const { option } = message;
          if (option === 'default') {
            await vscode.commands.executeCommand('appmap.clearNavieAiSettings');
          } else if (option === 'own-key') {
            await vscode.commands.executeCommand('appmap.openAIApiKey.set');
          } else {
            console.error(`Unknown option: ${option}`);
          }
          break;
        }
      }
    });

    return {
      status: ExplainResponseStatus.Success,
      codeSelection,
    };
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
    const dataService = new ChatSearchDataService(rpcService, appmaps);

    return new ChatSearchWebview(context, extensionState, dataService);
  }
}
