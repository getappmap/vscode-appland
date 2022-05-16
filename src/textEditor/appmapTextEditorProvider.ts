import { isAbsolute, join } from 'path';
import * as vscode from 'vscode';
import { Telemetry, APPMAP_OPEN, APPMAP_UPLOAD } from '../telemetry';
import { getNonce, getRecords, workspaceFolderForDocument } from '../util';
import { version } from '../../package.json';
import ExtensionState from '../configuration/extensionState';
import { AppmapUploader } from '../actions/appmapUploader';

/**
 * Provider for AppLand scenario files.
 */
export class AppMapTextEditorProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext, properties: ExtensionState): void {
    const provider = new AppMapTextEditorProvider(context, properties);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      AppMapTextEditorProvider.viewType,
      provider
    );
    context.subscriptions.push(providerRegistration);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.getAppmapState', () => {
        if (provider.currentWebView) {
          provider.currentWebView.webview.postMessage({
            type: 'requestAppmapState',
          });
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.setAppmapState', async () => {
        if (provider.currentWebView) {
          const state = await vscode.window.showInputBox({
            placeHolder: 'AppMap state serialized string',
          });
          if (state) {
            provider.currentWebView.webview.postMessage({
              type: 'setAppmapState',
              state: state,
            });
          }
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.setAppmapStateNoPrompt', async (state) => {
        if (provider.currentWebView) {
          provider.currentWebView.webview.postMessage({
            type: 'setAppmapState',
            state: state,
          });
        }
      })
    );
  }

  private static readonly viewType = 'appmap.views.appMapFile';
  private static readonly INSTRUCTIONS_VIEWED = 'APPMAP_INSTRUCTIONS_VIEWED';
  private static readonly RELEASE_KEY = 'APPMAP_RELEASE_KEY';
  public static readonly APPMAP_OPENED = 'APPMAP_OPENED';
  public static readonly INITIAL_STATE = 'INITIAL_STATE';
  public currentWebView?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly properties: ExtensionState
  ) {}

  /**
   * Called when our custom editor is opened.
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
    /* _token: vscode.CancellationToken */
  ): Promise<void> {
    this.currentWebView = webviewPanel;

    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this.currentWebView = e.webviewPanel;
      }
    });

    const initialState = (() => {
      const state = document.uri.fragment;
      if (state !== '') {
        try {
          JSON.parse(state);
          return state;
        } catch (e) {
          console.warn(e);
        }
      }
    })();
    if (initialState)
      this.context.globalState.update(AppMapTextEditorProvider.INITIAL_STATE, initialState);

    const updateWebview = () => {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText(),
      });

      const workspaceFolder = workspaceFolderForDocument(document);
      if (workspaceFolder) {
        this.properties.setWorkspaceOpenedAppMap(workspaceFolder, true);
      }

      const lastVersion = this.context.globalState.get(AppMapTextEditorProvider.RELEASE_KEY);
      if (!lastVersion) {
        this.context.globalState.update(AppMapTextEditorProvider.RELEASE_KEY, version);
      } else if (lastVersion !== version) {
        webviewPanel.webview.postMessage({
          type: 'displayUpdateNotification',
          version,
        });
      }

      const initialState = this.context.globalState.get(AppMapTextEditorProvider.INITIAL_STATE);
      if (initialState) {
        vscode.commands.executeCommand('appmap.setAppmapStateNoPrompt', initialState);
        this.context.globalState.update(AppMapTextEditorProvider.INITIAL_STATE, null);
      }
    };

    // Handle messages from the webview.
    // Note: this has to be set before setting the HTML to avoid a race.
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'viewSource':
          viewSource(message.text);
          break;
        case 'ready':
          updateWebview();
          break;
        case 'appmapStateResult':
          vscode.env.clipboard.writeText(message.state);
          vscode.window.setStatusBarMessage('AppMap state was copied to clipboard', 5000);
          break;
        case 'onLoadComplete':
          Telemetry.sendEvent(APPMAP_OPEN, {
            rootDirectory: workspaceFolderForDocument(document)?.uri.fsPath,
            uri: document.uri,
            metadata: JSON.parse(document.getText()).metadata,
            metrics: message.metrics,
          });
          break;
        case 'performAction':
          Telemetry.reportAction(
            message.action,
            getRecords(message.data, `appmap.${message.action}`)
          );
          break;
        case 'reportError':
          Telemetry.reportWebviewError(message.error);
          break;
        case 'closeUpdateNotification':
          this.context.globalState.update(AppMapTextEditorProvider.RELEASE_KEY, version);
          break;
        case 'appmapOpenUrl':
          vscode.env.openExternal(message.url);
          Telemetry.reportOpenUri(message.url);
          break;
        case 'uploadAppmap':
          {
            const uploadResult = await AppmapUploader.upload(document, this.context);
            if (uploadResult) {
              Telemetry.sendEvent(APPMAP_UPLOAD, {
                rootDirectory: workspaceFolderForDocument(document)?.uri.fsPath,
                uri: document.uri,
                metadata: JSON.parse(document.getText()).metadata,
                metrics: message.metrics,
              });
            }
          }
          break;
      }
    });

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Hook up event handlers so that we can synchronize the webview with the text document.
    //
    // The text document acts as our model, so we have to sync change in the document to our
    // editor and sync changes in the editor back to the document.
    //
    // Remember that a single text document can also be shared between multiple custom
    // editors (this happens for example when you split a custom editor)
    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });

    // Make sure we get rid of the listener when our editor is closed.
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      this.currentWebView = undefined;
    });

    function openFile(uri: vscode.Uri, lineNumber: number) {
      const showOptions = {
        viewColumn: vscode.ViewColumn.Beside,
        selection: new vscode.Range(
          new vscode.Position(lineNumber - 1, 0),
          new vscode.Position(lineNumber - 1, 0)
        ),
      };
      vscode.commands.executeCommand('vscode.open', uri, showOptions);
    }

    function viewSource(location: string) {
      const tokens = location.split(':', 2);
      const path = tokens[0];
      const lineNumberStr = tokens[1];
      let lineNumber = 1;
      if (lineNumberStr) {
        lineNumber = Number.parseInt(lineNumberStr, 10);
      }

      let searchPath;
      if (vscode.workspace.workspaceFolders) {
        for (let i = 0; !searchPath && i < vscode.workspace.workspaceFolders?.length; ++i) {
          const folder = vscode.workspace.workspaceFolders[i];
          // findFiles is not tolerant of absolute paths, even if the absolute path matches the
          // path of the file in the workspace.
          if (folder.uri.scheme === 'file' && path.startsWith(folder.uri.path)) {
            searchPath = path.slice(folder.uri.path.length + 1);
          }
        }
      }
      searchPath = searchPath || path;
      if (!isAbsolute(path)) {
        searchPath = join('**', path);
      }

      vscode.workspace.findFiles(searchPath).then((uris) => {
        if (uris.length === 0) {
          return;
        } else if (uris.length === 1) {
          openFile(uris[0], lineNumber);
        } else {
          const options: vscode.QuickPickOptions = {
            canPickMany: false,
            placeHolder: 'Choose file to open',
          };
          vscode.window
            .showQuickPick(
              uris.map((uri) => uri.toString()),
              options
            )
            .then((fileName) => {
              if (!fileName) {
                return false;
              }
              openFile(vscode.Uri.parse(fileName), lineNumber);
            });
        }
      });
    }
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(join(this.context.extensionPath, 'out', 'app.js'))
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();

    return /* html */ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <title>AppLand Scenario</title>
      </head>
      <body>
        <div id="app">
        </div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
        <script type="text/javascript" nonce="${nonce}">
          AppLandWeb.mountApp();
        </script>
      </body>
      </html>`;
  }

  //forget usage state set by this class
  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(AppMapTextEditorProvider.INSTRUCTIONS_VIEWED, null);
    context.globalState.update(AppMapTextEditorProvider.RELEASE_KEY, null);
    context.globalState.update(AppMapTextEditorProvider.APPMAP_OPENED, null);
    context.globalState.update(AppMapTextEditorProvider.INITIAL_STATE, null);
  }
}
