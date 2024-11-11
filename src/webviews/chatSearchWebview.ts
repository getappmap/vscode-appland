import { PinFileRequest } from '@appland/components';
import assert from 'assert';
import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
import appmapMessageHandler from './appmapMessageHandler';
import FilterStore, { SavedFilter } from './filterStore';
import WebviewList from './WebviewList';
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
  private _onWebview?: (wv: vscode.Webview) => void;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState,
    private readonly dataService: ChatSearchDataService,
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

  set onWebview(cb: (wv: vscode.Webview) => void) {
    this._onWebview = cb;
  }

  async doPinFiles(panel: vscode.WebviewPanel, reqs: PinFileRequest[]) {
    const maxPinnedFileSize = ExtensionSettings.maxPinnedFileSizeKB * 1024;
    type PinFileRequestWithLength = PinFileRequest & { contentLength?: number };
    const requests = await Promise.all(
      reqs.map(async (r: PinFileRequest): Promise<PinFileRequestWithLength> => {
        let contentLength = r.content?.length;
        if (!r.content) {
          assert(r.uri, `doPinFiles, ${r.name}: no content, no uri`);
          const u: vscode.Uri = vscode.Uri.file(r.uri.toString().replace(/file:\/\//g, ''));
          const stat = await vscode.workspace.fs.stat(u);
          contentLength = stat.size;
          if (contentLength < maxPinnedFileSize) {
            const doc = await vscode.workspace.openTextDocument(u);
            r.content = doc.getText();
          }
        }

        return {
          name: r.name,
          uri: r.uri,
          content: r.content,
          contentLength,
        };
      })
    );

    const goodRequests = requests.filter((r: PinFileRequestWithLength) => {
      if (r.contentLength > maxPinnedFileSize) {
        const setting = ExtensionSettings.maxPinnedFileSizeKB;
        const len = Math.round(r.contentLength / 1024);
        vscode.window
          .showErrorMessage(
            `${r.name} (${len}KB) exceeds the maximum file size of ${setting}KB.`,
            'Change',
            'Cancel'
          )
          .then((answer) => {
            if (answer === 'Change') {
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'appmap.maxPinnedFileSizeKB'
              );
            }
          });
        return false;
      }
      return true;
    });

    if (goodRequests.length > 0) {
      const msg = { type: 'pin-files', requests: goodRequests.map((r) => new PinFileRequest(r)) };
      panel.webview.postMessage(msg);
    }
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
    if (this._onWebview) {
      this._onWebview(panel.webview);
    }

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
      }),
      this.rpcService.onRpcPortChange(() => {
        panel.webview.postMessage({
          type: 'navie-restarted',
        });
      }),
      this.rpcService.onBeforeRestart(() => {
        panel.webview.postMessage({
          type: 'navie-restarting',
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
            useAnimation: ExtensionSettings.useAnimation,
            editorType: 'vscode',
          });
          break;
        case 'open-new-chat':
          void vscode.commands.executeCommand('appmap.explain');
          break;
        case 'open-record-instructions':
        case 'open-install-instructions':
          await vscode.commands.executeCommand('appmap.openInstallGuide');
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
          switch (option) {
            case 'default':
              this.rpcService.updateSettings({
                useCopilot: false,
                openAIApiKey: '',
                env: {
                  OPENAI_BASE_URL: undefined,
                  OPENAI_API_KEY: undefined,
                  AZURE_OPENAI_API_KEY: undefined,
                  ANTHROPIC_API_KEY: undefined,
                },
              });
              break;

            case 'copilot':
              this.rpcService.updateSettings({ useCopilot: true });
              break;

            case 'own-key':
              this.rpcService.updateSettings({
                useCopilot: false,
                openAIApiKey: await vscode.window.showInputBox({ placeHolder: 'OpenAI API Key' }),
                env: {
                  OPENAI_BASE_URL: undefined,
                },
              });
              break;

            default:
              console.error(`Unknown option: ${option}`);
          }
          break;
        }
        case 'choose-files-to-pin': {
          await this.chooseFilesToPin().then(async (uris: vscode.Uri[] | undefined) => {
            if (!uris) return;
            const requests: PinFileRequest[] = uris.map((u) => ({
              name: u.toString(),
              uri: u.toString(),
            }));
            this.doPinFiles(panel, requests);
          });
          break;
        }

        case 'click-link': {
          const location = await parseLocation(message.link);
          if (location) {
            const uri = location instanceof vscode.Location ? location.uri : location;
            await vscode.commands.executeCommand('vscode.open', uri);
          }
          break;
        }

        case 'fetch-pinned-files': {
          const { requests } = message;
          this.doPinFiles(panel, requests);
          break;
        }
      }
    });

    return {
      status: ExplainResponseStatus.Success,
      codeSelection,
    };
  }

  async chooseFilesToPin() {
    return vscode.window.showOpenDialog({ canSelectMany: true });
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

    return new ChatSearchWebview(context, extensionState, dataService, rpcService);
  }
}
