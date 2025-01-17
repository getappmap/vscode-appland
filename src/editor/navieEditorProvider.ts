import { basename } from 'path';
import vscode, {
  CustomDocument,
  CustomEditorProvider,
  CustomReadonlyEditorProvider,
  ExtensionContext,
  Uri,
} from 'vscode';
import ExtensionState from '../configuration/extensionState';
import ChatSearchDataService from '../services/chatSearchDataService';
import RpcProcessService from '../services/rpcProcessService';
import getWebviewContent from '../webviews/getWebviewContent';
import { NodeProcessService } from '../services/nodeProcessService';
import appmapMessageHandler from '../webviews/appmapMessageHandler';
import { parseLocation } from '../util';
import { getApiKey } from '../authentication';
import { proxySettings } from '../lib/proxySettings';
import ExtensionSettings from '../configuration/extensionSettings';
import { PinFileRequest } from '@appland/components';
import assert from 'assert';
import { threadId } from 'worker_threads';
import AppMapCollection from '../services/appmapCollection';

class NavieDocument implements CustomDocument {
  constructor(public readonly uri: Uri) {}

  get threadId(): string {
    const uri = this.uri.toString();
    const fileName = basename(uri);
    return fileName.replace(/\.navie\.jsonl$/, '');
  }

  dispose(): void {
    // noop
  }
}

export default class NavieEditorProvider implements CustomReadonlyEditorProvider<NavieDocument> {
  private static readonly viewType = 'appmap.views.navie';

  public static register(
    context: ExtensionContext,
    extensionState: ExtensionState,
    appmaps: AppMapCollection,
    rpcService: RpcProcessService
  ): void {
    const dataService = new ChatSearchDataService(rpcService, appmaps);
    const provider = new NavieEditorProvider(context, extensionState, dataService, rpcService);
    context.subscriptions.push(
      vscode.window.registerCustomEditorProvider(NavieEditorProvider.viewType, provider, {
        webviewOptions: { retainContextWhenHidden: true },
      })
    );
  }

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState,
    private readonly dataService: ChatSearchDataService,
    private readonly rpcService: RpcProcessService
  ) {}

  public openCustomDocument(uri: Uri): NavieDocument {
    return new NavieDocument(uri);
  }

  public async resolveCustomEditor(
    document: NavieDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
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
      return;
    }

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = getWebviewContent(
      webviewPanel.webview,
      this.context,
      'AppMap AI: Explain',
      'chat-search',
      { rpcPort: appmapRpcPort }
    );

    vscode.workspace.workspaceFolders?.forEach((workspaceFolder) => {
      this.extensionState.setWorkspaceOpenedNavie(workspaceFolder, true);
    });

    this.context.subscriptions.push(
      this.rpcService.onRpcPortChange(() => {
        webviewPanel.webview.postMessage({
          type: 'navie-restarted',
        });
      }),
      this.rpcService.onBeforeRestart(() => {
        webviewPanel.webview.postMessage({
          type: 'navie-restarting',
        });
      })
    );

    const mostRecentAppMaps = this.dataService.latestAppMaps();
    const codeSelection = await this.dataService.codeSelection();

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'chat-search-ready':
          webviewPanel.webview.postMessage({
            type: 'initChatSearch',
            appmapRpcPort,
            codeSelection,
            proxySettings: proxySettings(),
            appmapYmlPresent: true, // Note that at the moment this is always true
            mostRecentAppMaps,
            apiUrl: ExtensionSettings.apiUrl,
            apiKey: await getApiKey(false),
            useAnimation: ExtensionSettings.useAnimation,
            editorType: 'vscode',
            threadId: document.threadId,
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
            this.doPinFiles(webviewPanel, requests);
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
          this.doPinFiles(webviewPanel, requests);
          break;
        }

        case 'save-message': {
          const {
            message: { content, messageId, threadId },
          } = message;
          // Metadata is written as link reference definitions. The references don't exist, so the content should be
          // stripped out by markdown renderers. In other words, this will not be rendered in the final HTML output.
          const metadataFooter = Object.entries({ messageId, threadId }).reduce(
            (acc, [k, v]) => (acc += `[//]: # (${k}: ${v})\n`),
            '[//]: # (This content was generated by AppMap Navie.)\n'
          );
          const document = await vscode.workspace.openTextDocument({
            language: 'markdown',
            content: [content.replace(/^\s*<!-- file:.* -->/gm, ''), metadataFooter].join('\n\n'),
          });
          vscode.window.showTextDocument(document, vscode.ViewColumn.Active);
          break;
        }
      }
    });
  }

  async chooseFilesToPin() {
    return vscode.window.showOpenDialog({ canSelectMany: true });
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
}
