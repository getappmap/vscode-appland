import * as vscode from 'vscode';
import * as fs from 'fs';
import { Telemetry, DEBUG_EXCEPTION } from '../telemetry';
import ExtensionState from '../configuration/extensionState';
import extensionSettings from '../configuration/extensionSettings';
import AppMapDocument from './AppMapDocument';
import AnalysisManager from '../services/analysisManager';
import { getStackLocations, StackLocation } from '../lib/getStackLocations';
import { ResolvedFinding } from '../services/resolvedFinding';
import getWebviewContent from '../webviews/getWebviewContent';
import ErrorCode from '../telemetry/definitions/errorCodes';
import {
  getModulePath,
  OutputStream,
  ProcessLog,
  ProgramName,
  spawn,
  verifyCommandOutput,
} from '../services/nodeDependencyProcess';
import { basename } from 'path';
import { readFile } from 'fs/promises';
import appmapMessageHandler from '../webviews/appmapMessageHandler';
import FilterStore from '../webviews/filterStore';
import WebviewList from '../webviews/WebviewList';
import AssetService, { AssetIdentifier } from '../assets/assetService';

export type FindingInfo = ResolvedFinding & {
  stackLocations?: StackLocation[];
};

export type FunctionStats = {
  count: number;
  size: number;
  function: string;
  location: string;
};

export type SavedFilter = {
  filterName: string;
  state: string;
  default: boolean;
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
    return provider;
  }

  public static readonly APPMAP_OPENED = 'APPMAP_OPENED';

  private static readonly viewType = 'appmap.views.appMapFile';
  private static readonly LARGE_APPMAP_SIZE = 10 * 1000 * 1000; // 10 MB
  private static readonly GIANT_APPMAP_SIZE = 200 * 1000 * 1000; // 200 MB
  private static readonly EMPTY_APPMAP_DATA = '{}';
  private static readonly analysisManager = AnalysisManager;

  private filterStore: FilterStore;
  private webviewList = new WebviewList();
  private documents = new Array<AppMapDocument>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly extensionState: ExtensionState
  ) {
    this.filterStore = new FilterStore(context);
    this.filterStore.onDidChangeFilters((event) => {
      this.updateFilters(event.savedFilters);
    });
  }

  get currentWebview(): vscode.Webview | undefined {
    return this.webviewList.currentWebview;
  }

  async openCustomDocument(appMapOrSequenceDiagramDiffUri: vscode.Uri): Promise<AppMapDocument> {
    let appMapUri: vscode.Uri;
    let sequenceDiagramData: string | undefined;

    function abortSequenceDiagramDiff(msg: string): AppMapDocument {
      throw new Error(['Unable to open sequence diagram', msg].join(': '));
    }

    if (appMapOrSequenceDiagramDiffUri.fsPath.endsWith('.diff.sequence.json')) {
      sequenceDiagramData = await readFile(appMapOrSequenceDiagramDiffUri.fsPath, 'utf-8');
      const appMapTokens = appMapOrSequenceDiagramDiffUri.fsPath.split('/');
      const diffIndex = appMapTokens.lastIndexOf('diff');
      if (diffIndex === -1)
        return abortSequenceDiagramDiff(
          `Expected to find a 'diff' directory in the path ${appMapOrSequenceDiagramDiffUri.fsPath}`
        );

      appMapTokens[diffIndex] = 'head';
      appMapTokens[appMapTokens.length - 1] = [
        basename(appMapTokens[appMapTokens.length - 1], '.diff.sequence.json'),
        '.appmap.json',
      ].join('');
      const appMapPath = appMapTokens.join('/');
      if (!fs.existsSync(appMapPath))
        return abortSequenceDiagramDiff(`Expected AppMap file ${appMapPath} to exist`);

      // Resolve relative to the diff file
      appMapUri = vscode.Uri.file(appMapPath);
    } else {
      appMapUri = appMapOrSequenceDiagramDiffUri;
    }

    const fileStats = fs.statSync(appMapUri.fsPath);
    const appmapFileSize = fileStats.size;
    const functions = await this.generateStats(appMapUri);
    const stats = { functions };

    let appMapData = AppMapEditorProvider.EMPTY_APPMAP_DATA;

    // If the map is Giant, don't read it into memory
    if (appmapFileSize > AppMapEditorProvider.GIANT_APPMAP_SIZE)
      return new AppMapDocument(appMapUri, appMapData, stats, []);

    // If the map is Large, automatically prune it to ~ 10 MB
    if (appmapFileSize > AppMapEditorProvider.LARGE_APPMAP_SIZE) {
      const prunedData = await this.pruneMap(appMapUri);
      if (prunedData) appMapData = prunedData;
    }

    // If map is not Giant or Large or if pruning failed, read the data from the file
    if (appMapData === AppMapEditorProvider.EMPTY_APPMAP_DATA)
      appMapData = (await vscode.workspace.fs.readFile(appMapUri)).toString();

    const findings = this.retrieveAndProcessFindings(appMapUri);

    return new AppMapDocument(
      appMapOrSequenceDiagramDiffUri,
      appMapData,
      stats,
      findings,
      sequenceDiagramData
    );
  }

  outputLogToString(log: ProcessLog): string {
    return log
      .filter((line) => line.stream === OutputStream.Stdout)
      .map((line) => line.data)
      .join('');
  }

  async pruneMap(uri: vscode.Uri): Promise<string | undefined> {
    const modulePath = getModulePath(ProgramName.Appmap);
    const binPath = AssetService.getAssetPath(AssetIdentifier.AppMapCli);
    const pruneCommand = spawn({
      modulePath,
      binPath,
      args: ['prune', uri.fsPath, '--size', '10mb', '--output-data', '--auto'],
      saveOutput: true,
    });

    try {
      await verifyCommandOutput(pruneCommand);
      const pruneString = this.outputLogToString(pruneCommand.log);
      return pruneString;
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.PruneLargeMapError,
        log: pruneCommand.log.toString(),
      });
    }
  }

  async generateStats(uri: vscode.Uri): Promise<FunctionStats[] | undefined> {
    const modulePath = getModulePath(ProgramName.Appmap);
    const binPath = AssetService.getAssetPath(AssetIdentifier.AppMapCli);
    const statsCommand = spawn({
      modulePath,
      binPath,
      args: [
        'stats',
        '--appmap-file',
        uri.fsPath,
        '--limit',
        String(Number.MAX_SAFE_INTEGER),
        '--format',
        'json',
      ],
      saveOutput: true,
    });

    try {
      await verifyCommandOutput(statsCommand);
      const statsString = this.outputLogToString(statsCommand.log);
      return JSON.parse(statsString);
    } catch (e) {
      Telemetry.sendEvent(DEBUG_EXCEPTION, {
        exception: e as Error,
        errorCode: ErrorCode.GenerateMapStatsError,
        log: statsCommand.log.toString(),
      });
      return;
    }
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

  updateFilters(savedFilters: SavedFilter[]): void {
    this.webviewList.webviews.forEach((webview) =>
      webview.postMessage({
        type: 'updateSavedFilters',
        savedFilters,
      })
    );
  }

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
    this.webviewList.enroll(webviewPanel);

    webviewPanel.onDidChangeViewState(() => {
      webviewPanel.webview.postMessage({
        type: 'setActive',
        active: webviewPanel.active,
      });
    });

    const updateWebview = (initialState: string | undefined) => {
      webviewPanel.webview.postMessage({
        type: 'update',
        appMap: document.appMap,
        sequenceDiagram: document.sequenceDiagram,
      });

      const { workspaceFolder } = document;
      if (workspaceFolder) {
        this.extensionState.setWorkspaceOpenedAppMap(workspaceFolder, true);
      }

      if (initialState)
        webviewPanel.webview.postMessage({
          type: 'setAppmapState',
          state: initialState,
        });
    };

    const initialState = (() => {
      const state = document.uri.fragment;
      if (state !== undefined && state !== '') {
        try {
          JSON.parse(state);
          return state;
        } catch (e) {
          console.warn(e);
        }
      }
    })();

    // Handle messages from the webview.
    // Note: this has to be set before setting the HTML to avoid a race.
    webviewPanel.webview.onDidReceiveMessage(
      appmapMessageHandler(this.filterStore, document.workspaceFolder)
    );
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'ready':
          updateWebview(initialState);
          break;
        case 'appmap-ready':
          webviewPanel.webview.postMessage({
            type: 'init-appmap',
            shareEnabled: false,
            defaultView: extensionSettings.defaultDiagramView || 'viewSequence',
            savedFilters: this.filterStore.getSavedFilters(),
            appmapFsPath: document.uri.fsPath,
          });
          break;
        case 'onLoadComplete':
          this.documents.push(document);
          break;
        case 'ask-navie-about-map': {
          const mapFsPath = message.mapFsPath;
          try {
            const appmapString = fs.readFileSync(mapFsPath, 'utf-8');
            const appmap = JSON.parse(appmapString);
            vscode.commands.executeCommand('appmap.explain', {
              targetAppmap: appmap,
              targetAppmapFsPath: mapFsPath,
            });
          } catch (e) {
            console.error('Error reading appmap file: ', e);
          }
        }
      }
    });

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.onDidDispose(() => {
      removeOne(this.documents, document);
      if (document.workspaceFolder)
        this.extensionState.setClosedAppMap(document.workspaceFolder, true);
    });
  }

  /**
   * Get the static html used for the editor webviews.
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    return getWebviewContent(webview, this.context, 'AppMap Diagram', 'app');
  }

  //forget usage state set by this class
  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(AppMapEditorProvider.APPMAP_OPENED, null);
  }
}

/**
 * Removes at most one instance of value from array.
 */
function removeOne<T>(array: Array<T>, value: T): void {
  const position = array.indexOf(value);
  if (position >= 0) array.splice(position, 1);
}
