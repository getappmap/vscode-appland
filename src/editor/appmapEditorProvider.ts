import * as vscode from 'vscode';
import { Telemetry, APPMAP_OPEN, APPMAP_UPLOAD, EXPORT_SVG, DEBUG_EXCEPTION } from '../telemetry';
import { getRecords } from '../util';
import { version } from '../../package.json';
import ExtensionState from '../configuration/extensionState';
import extensionSettings from '../configuration/extensionSettings';
import { AppmapUploader } from '../actions/appmapUploader';
import { bestFilePath } from '../lib/bestFilePath';
import AppMapDocument from './AppMapDocument';
import AnalysisManager from '../services/analysisManager';
import { getStackLocations, StackLocation } from '../lib/getStackLocations';
import { ResolvedFinding } from '../services/resolvedFinding';
import getWebviewContent from '../webviews/getWebviewContent';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { promisify } from 'util';
import { tmpName } from 'tmp';
import { writeFile } from 'fs/promises';

export type FindingInfo = ResolvedFinding & {
  stackLocations?: StackLocation[];
};

/**
 * Provider for AppLand scenario files.
 */
export default class AppMapEditorProvider
  implements vscode.CustomReadonlyEditorProvider<AppMapDocument>
{
  public static register(
    context: vscode.ExtensionContext,
    extensionState: ExtensionState
  ): AppMapEditorProvider {
    const provider = new AppMapEditorProvider(context, extensionState);
    const providerRegistration = vscode.window.registerCustomEditorProvider(
      AppMapEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    );
    context.subscriptions.push(providerRegistration);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.getAppmapState', () => {
        if (provider.currentWebView) {
          provider.currentWebView.webview.postMessage({
            type: 'requestAppmapState',
          });
          // TODO: Wait for the state to be provided and then put it on the clipboard.
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

    return provider;
  }

  private static readonly viewType = 'appmap.views.appMapFile';
  private static readonly INSTRUCTIONS_VIEWED = 'APPMAP_INSTRUCTIONS_VIEWED';
  private static readonly RELEASE_KEY = 'APPMAP_RELEASE_KEY';
  private static readonly analysisManager = AnalysisManager;
  private static readonly openWebviewPanels = new Map<string, vscode.WebviewPanel>();
  public static readonly APPMAP_OPENED = 'APPMAP_OPENED';
  public currentWebView?: vscode.WebviewPanel;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState
  ) {}

  async openCustomDocument(uri: vscode.Uri): Promise<AppMapDocument> {
    const data = await vscode.workspace.fs.readFile(uri);
    const findings = this.retrieveAndProcessFindings(uri);

    return new AppMapDocument(uri, data, findings);
  }

  retrieveAndProcessFindings(uri: vscode.Uri): FindingInfo[] {
    const allFindings = AppMapEditorProvider.analysisManager.findingsIndex?.findings() || [];
    const associatedFindings = allFindings.filter(
      (finding) => finding.appMapUri?.path === uri.path
    );

    return associatedFindings.map((finding) => {
      const findingData = finding as FindingInfo;
      findingData.stackLocations = getStackLocations(finding);
      return findingData;
    });
  }

  private documents = new Array<AppMapDocument>();

  /**
   * The currently open documents or an empty array.
   */
  public get openDocuments(): readonly AppMapDocument[] {
    return this.documents;
  }

  /**
   * Called when our custom editor is opened.
   */
  public async resolveCustomEditor(
    document: AppMapDocument,
    webviewPanel: vscode.WebviewPanel
    /* _token: vscode.CancellationToken */
  ): Promise<void> {
    this.currentWebView = webviewPanel;

    webviewPanel.onDidChangeViewState((e) => {
      if (e.webviewPanel.active) {
        this.currentWebView = e.webviewPanel;
      }
    });

    const updateWebview = () => {
      webviewPanel.webview.postMessage({
        type: 'update',
        text: document.data,
      });

      const { workspaceFolder } = document;
      if (workspaceFolder) {
        this.extensionState.setWorkspaceOpenedAppMap(workspaceFolder, true);
      }

      const lastVersion = this.context.globalState.get(AppMapEditorProvider.RELEASE_KEY);
      if (!lastVersion) {
        this.context.globalState.update(AppMapEditorProvider.RELEASE_KEY, version);
      } else if (lastVersion !== version) {
        webviewPanel.webview.postMessage({
          type: 'displayUpdateNotification',
          version,
        });
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
        case 'appmap-ready':
          webviewPanel.webview.postMessage({
            type: 'init-appmap',
            shareEnabled: extensionSettings.shareEnabled,
            defaultView: extensionSettings.defaultDiagramView,
          });
          break;
        case 'appmapStateResult':
          // Putting this directly on the clipboard is not what we always want;
          // although it is what appmap.getAppmapState wants.
          vscode.env.clipboard.writeText(message.state);
          vscode.window.setStatusBarMessage('AppMap state was copied to clipboard', 5000);
          break;
        case 'onLoadComplete':
          AppMapEditorProvider.openWebviewPanels.set(document.uri.toString(), webviewPanel);
          this.documents.push(document);
          Telemetry.sendEvent(APPMAP_OPEN, {
            rootDirectory: document.workspaceFolder?.uri.fsPath,
            uri: document.uri,
            metadata: document.metadata,
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
          this.context.globalState.update(AppMapEditorProvider.RELEASE_KEY, version);
          break;
        case 'appmapOpenUrl':
          vscode.env.openExternal(message.url);
          Telemetry.reportOpenUri(message.url);
          break;
        case 'uploadAppmap':
          {
            const { viewState } = message;
            const uploadResult = await AppmapUploader.upload(
              Buffer.from(document.raw),
              this.context,
              viewState
            );
            if (uploadResult) {
              Telemetry.sendEvent(APPMAP_UPLOAD, {
                rootDirectory: document.workspaceFolder?.uri.fsPath,
                uri: document.uri,
                metadata: document.metadata,
                metrics: message.metrics,
              });
            }
            webviewPanel.webview.postMessage({
              type: 'setShareURL',
              url: uploadResult,
            });
          }
          break;
        case 'copyToClipboard':
          vscode.env.clipboard.writeText(message.stringToCopy);
          break;
        case 'exportSVG':
          {
            try {
              const { svgString } = message;
              if (svgString) {
                const diagramFile = (await promisify(tmpName)()) + '.svg';
                await writeFile(diagramFile, svgString);
                const uri = vscode.Uri.file(diagramFile);
                vscode.env.openExternal(uri);
                Telemetry.sendEvent(EXPORT_SVG);
              }
            } catch (e) {
              Telemetry.sendEvent(DEBUG_EXCEPTION, {
                exception: e as Error,
                errorCode: ErrorCode.ExportSvgError,
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

    webviewPanel.onDidDispose(() => {
      this.currentWebView = undefined;
      AppMapEditorProvider.openWebviewPanels.delete(document.uri.toString());
      removeOne(this.documents, document);
      if (document.workspaceFolder)
        this.extensionState.setClosedAppMap(document.workspaceFolder, true);
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

    async function viewSource(location: string): Promise<void> {
      const tokens = location.split(':', 2);
      const path = tokens[0];
      const lineNumberStr = tokens[1];
      let lineNumber = 1;
      if (lineNumberStr) {
        lineNumber = Number.parseInt(lineNumberStr, 10);
      }

      const fileUri = await bestFilePath(path, document.workspaceFolder);
      if (fileUri) openFile(fileUri, lineNumber);
    }
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return getWebviewContent(webview, this.context, 'AppLand Scenario', 'app');
  }

  //forget usage state set by this class
  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(AppMapEditorProvider.INSTRUCTIONS_VIEWED, null);
    context.globalState.update(AppMapEditorProvider.RELEASE_KEY, null);
    context.globalState.update(AppMapEditorProvider.APPMAP_OPENED, null);
  }

  public static setState(uri: vscode.Uri, state: string | Record<string, unknown>): void {
    const panel = this.openWebviewPanels.get(uri.toString());
    if (panel) {
      panel.webview.postMessage({
        type: 'setAppmapState',
        state:
          typeof state === 'string'
            ? state
            : Buffer.from(JSON.stringify(state), 'utf-8').toString('base64url'),
      });
    }
  }

  public static async webviewReady(
    uri: vscode.Uri,
    timeoutSeconds = 10,
    tickRateMs = 100
  ): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutSeconds * 1000) {
      if (this.openWebviewPanels.has(uri.toString())) return true;
      await new Promise((resolve) => setTimeout(resolve, tickRateMs));
    }
    return false;
  }
}

/**
 * Removes at most one instance of value from array.
 */
function removeOne<T>(array: Array<T>, value: T): void {
  const position = array.indexOf(value);
  if (position >= 0) array.splice(position, 1);
}
