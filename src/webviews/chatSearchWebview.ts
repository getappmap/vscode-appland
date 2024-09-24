import { PinFileRequest } from '@appland/components';
import assert from 'assert';
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
import WebviewList from './WebviewList';

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
  private _onWebview?: (wv: vscode.Webview) => void;
  private webviewList = new WebviewList();

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

  get currentWebview(): vscode.Webview | undefined {
    return this.webviewList.currentWebview;
  }

  set onWebview(cb: (wv: vscode.Webview) => void) {
    this._onWebview = cb;
  }

  async doPinFiles(webview: vscode.Webview, reqs: PinFileRequest[]) {
    const maxPinnedFileSize = ExtensionSettings.maxPinnedFileSizeKB * 1024;
    type PinFileRequestWithLength = PinFileRequest & { contentLength?: number };
    const requests = await Promise.all(
      reqs.map(async (r: PinFileRequest): Promise<PinFileRequestWithLength> => {
        let contentLength = r.content?.length;
        if (!r.content) {
          assert(r.uri, `doPinFiles, ${r.name}: no content, no uri`);
          const u: vscode.Uri = vscode.Uri.parse(r.uri);
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
      webview.postMessage(msg);
    }
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
    this.webviewList.enroll(panel);
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

    if (this._onWebview) {
      this._onWebview(webview);
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
        case 'choose-files-to-pin': {
          await this.chooseFilesToPin().then(async (uris: vscode.Uri[] | undefined) => {
            if (!uris) return;
            const requests: PinFileRequest[] = uris.map((u) => ({
              name: u.toString(),
              uri: u.toString(),
            }));
            this.doPinFiles(webview, requests);
          });
          break;
        }

        case 'fetch-pinned-files': {
          const { requests } = message;
          this.doPinFiles(webview, requests);
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

  async chooseFilesToPin() {
    return vscode.window.showOpenDialog({ canSelectMany: true });
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
