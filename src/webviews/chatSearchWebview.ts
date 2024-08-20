import * as vscode from 'vscode';
import getWebviewContent from './getWebviewContent';
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
import { Telemetry } from '../telemetry';

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

export type NavieViewState = {
  threadId: string | undefined;
};

export default class ChatSearchWebview {
  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState,
    private readonly dataService: ChatSearchDataService
  ) {
    context.subscriptions.push(
      CommandRegistry.registerCommand('appmap.explain.impl', this.explain.bind(this)),
      vscode.window.registerWebviewPanelSerializer('appmap.navie', {
        deserializeWebviewPanel: this.deserializeWebviewPanel.bind(this),
      }),
      vscode.window.registerWebviewViewProvider('appmap.navie', {
        resolveWebviewView: this.resolveWebviewView.bind(this),
      })
    );
  }

  async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: unknown) {
    return this.configureWebviewPanel(
      webviewPanel,
      undefined,
      state ? (state as NavieViewState) : undefined
    );
  }

  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext
    // token: vscode.CancellationToken
  ): Promise<void> {
    let state: NavieViewState | undefined;
    if (context.state) state = context.state as NavieViewState;

    await this.configureWebviewView(webviewView.webview, undefined, state);
  }

  async configureWebviewPanel(
    panel: vscode.WebviewPanel,
    codeSelection?: CodeSelection,
    state?: NavieViewState
  ): Promise<void> {
    await this.configureWebviewView(panel.webview, codeSelection, state);
  }

  async configureWebviewView(
    webview: vscode.Webview,
    codeSelection?: CodeSelection,
    state?: NavieViewState
  ) {
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

    webview.html = getWebviewContent(webview, this.context, 'AppMap AI: Explain', 'chat-search', {
      rpcPort: appmapRpcPort,
    });

    this.context.subscriptions.push(
      this.dataService.onAppMapsUpdated((appmaps: LatestAppMap[]) => {
        webview.postMessage({
          type: 'update',
          mostRecentAppMaps: appmaps,
        });
      })
    );

    const mostRecentAppMaps = this.dataService.latestAppMaps();

    webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'viewSource':
          // TODO: Restore this
          // viewSource(message.text, workspace);
          break;
        case 'reportError':
          Telemetry.reportWebviewError(message.error);
          break;
        case 'appmapOpenUrl':
          vscode.env.openExternal(message.url);
          break;
        case 'chat-search-ready':
          webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            codeSelection,
            proxySettings: proxySettings(),
            appmapYmlPresent: true, // Note that at the moment this is always true
            mostRecentAppMaps,
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
            threadId: state?.threadId,
            /* TODO: Restore these
            targetAppmap,
            targetAppmapFsPath,
            suggestion,
            */
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
  }

  async explain({
    workspace,
    codeSelection,
    targetAppmap,
    targetAppmapFsPath,
    suggestion,
  }: ExplainOpts = {}): Promise<ExplainResponse> {
    const panel = vscode.window.createWebviewPanel(
      'appmap.navie',
      'AppMap AI: Explain',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    codeSelection ||= await this.dataService.codeSelection();

    await this.configureWebviewPanel(panel, codeSelection);

    vscode.workspace.workspaceFolders?.forEach((workspaceFolder) => {
      this.extensionState.setWorkspaceOpenedNavie(workspaceFolder, true);
    });

    return {
      status: ExplainResponseStatus.Success,
      codeSelection,
    };
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
