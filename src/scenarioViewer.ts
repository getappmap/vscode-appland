import { isAbsolute, join } from 'path';
import * as vscode from 'vscode';
import { Telemetry, APPMAP_OPEN } from './telemetry';
import { getNonce, getStringRecords, workspaceFolderForDocument } from './util';
import { version } from '../package.json';
import AppMapProperties from './appmapProperties';
import { AppmapUploader } from './appmapUploader';

/**
 * Provider for AppLand scenario files.
 */
export class ScenarioProvider implements vscode.CustomTextEditorProvider {
  public static register(context: vscode.ExtensionContext, properties: AppMapProperties): void {
    const provider = new ScenarioProvider(context, properties);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      ScenarioProvider.viewType,
      provider
    );
    context.subscriptions.push(providerRegistration);
  }

  private static readonly viewType = 'appmap.views.appMapFile';
  private static readonly INSTRUCTIONS_VIEWED = 'APPMAP_INSTRUCTIONS_VIEWED';
  private static readonly RELEASE_KEY = 'APPMAP_RELEASE_KEY';
  public static readonly APPMAP_OPENED = 'APPMAP_OPENED';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly properties: AppMapProperties
  ) {}

  /**
   * Called when our custom editor is opened.
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel
    /* _token: vscode.CancellationToken */
  ): Promise<void> {
    const updateWebview = () => {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.getText(),
      });

      const workspaceFolder = workspaceFolderForDocument(document);
      if (workspaceFolder) {
        this.properties.setWorkspaceOpenedAppMap(workspaceFolder, true);
      }

      // show AppMap instructions on first open
      if (!this.context.globalState.get(ScenarioProvider.INSTRUCTIONS_VIEWED)) {
        webviewPanel.webview.postMessage({
          type: 'showInstructions',
        });
        this.context.globalState.update(ScenarioProvider.INSTRUCTIONS_VIEWED, true);
      }

      const lastVersion = this.context.globalState.get(ScenarioProvider.RELEASE_KEY);
      if (!lastVersion) {
        this.context.globalState.update(ScenarioProvider.RELEASE_KEY, version);
      } else if (lastVersion !== version) {
        webviewPanel.webview.postMessage({
          type: 'displayUpdateNotification',
          version,
        });
      }
    };

    // Handle messages from the webview.
    // Note: this has to be set before setting the HTML to avoid a race.
    webviewPanel.webview.onDidReceiveMessage((message) => {
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
            getStringRecords(message.data, `appmap.${message.action}`)
          );
          break;
        case 'reportError':
          Telemetry.reportWebviewError(message.error);
          break;
        case 'closeUpdateNotification':
          this.context.globalState.update(ScenarioProvider.RELEASE_KEY, version);
          break;
        case 'appmapOpenUrl':
          vscode.env.openExternal(message.url);
          Telemetry.reportOpenUri(message.url);
          break;
        case 'uploadAppmap':
          AppmapUploader.upload(document, this.context);
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

  private getDocumentAsJson(document: vscode.TextDocument): Record<string, unknown> {
    const text = document.getText();
    if (text.trim().length === 0) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error('Could not get document as json. Content is not valid json');
    }
  }

  //forget usage state set by this class
  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(ScenarioProvider.INSTRUCTIONS_VIEWED, null);
    context.globalState.update(ScenarioProvider.RELEASE_KEY, null);
    context.globalState.update(ScenarioProvider.APPMAP_OPENED, null);
  }
}
