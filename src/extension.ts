import * as vscode from 'vscode';

import assert from 'assert';
import RemoteRecording from './actions/remoteRecording';
import AppMapService from './appMapService';
import addToContext from './commands/addToContext';
import deleteAllAppMaps from './commands/deleteAllAppMaps';
import registerInspectCodeObject from './commands/inspectCodeObject';
import registerSequenceDiagram from './commands/sequenceDiagram';
import registerCompareSequenceDiagrams from './commands/compareSequenceDiagram';
import openCodeObjectInAppMap from './commands/openCodeObjectInAppMap';
import outOfDateTests from './commands/outOfDateTests';
import PickCopilotModelCommand from './commands/pickCopilotModel';
import QuickReviewCommand from './commands/quickReview';
import ExtensionState from './configuration/extensionState';
import AppMapEditorProvider from './editor/appmapEditorProvider';
import appmapHoverProvider from './hover/appmapHoverProvider';
import ProcessServiceImpl from './processServiceImpl';
import { resetUsageState } from './commands/resetUsageState';
import AppMapCollectionFile from './services/appmapCollectionFile';
import { AppmapUptodateService } from './services/appmapUptodateService';
import { AppMapWatcher } from './services/appmapWatcher';
import ChatCompletion from './services/chatCompletion';
import ClassMapIndex from './services/classMapIndex';
import LineInfoIndex from './services/lineInfoIndex';
import { NodeProcessService } from './services/nodeProcessService';
import ProjectStateService from './services/projectStateService';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import { initializeWorkspaceServices } from './services/workspaceServices';
import { DEBUG_EXCEPTION, Telemetry } from './telemetry';
import appmapLinkProvider from './terminalLink/appmapLinkProvider';
import registerTrees from './tree';
import ContextMenu from './tree/contextMenu';
import InstallGuideWebView from './webviews/installGuideWebview';
import UriHandler from './uri/uriHandler';
import OpenAppMapUriHandler from './uri/openAppMapUriHandler';
import generateOpenApi from './commands/generateOpenApi';
import AppMapServerConfiguration from './services/appmapServerConfiguration';
import AppMapServerAuthenticationProvider from './authentication/appmapServerAuthenticationProvider';
import installAgent from './commands/installAgent';
import AnalysisManager from './services/analysisManager';
import Environment from './configuration/environment';
import ErrorCode from './telemetry/definitions/errorCodes';
import FindingsOverviewWebview from './webviews/findingsWebview';
import FindingInfoWebview from './webviews/findingInfoWebview';
import { AppMapRecommenderService } from './services/appmapRecommenderService';
import openCodeObjectInSource from './commands/openCodeObjectInSource';
import learnMoreRuntimeAnalysis from './commands/learnMoreRuntimeAnalysis';
import SignInViewProvider from './webviews/signInWebview';
import SignInManager from './services/signInManager';
import { AppmapConfigManager } from './services/appmapConfigManager';
import { findByName } from './commands/findByName';
import downloadLatestJavaJar from './commands/downloadLatestJavaJar';
import IndexJanitor from './lib/indexJanitor';
import { unregister as unregisterTerminal } from './commands/installer/terminals';
import getAppmapDir from './commands/getAppmapDir';
import checkAndTriggerFirstAppMapNotification from './lib/firstAppMapNotification';
import Watcher from './services/watcher';
import ChatSearchWebview from './webviews/chatSearchWebview';
import quickSearch from './commands/quickSearch';
import appmapState from './commands/appmapState';
import navieConfigurationService, {
  migrateOpenAIApiKey,
} from './services/navieConfigurationService';
import RpcProcessService from './services/rpcProcessService';
import CommandRegistry from './commands/commandRegistry';
import AssetService from './assets/assetService';
import clearNavieAiSettings from './commands/clearNavieAiSettings';
import ExtensionSettings from './configuration/extensionSettings';
import OpenNavieHistoryCommand from './commands/openNavieHistory';

export async function activate(context: vscode.ExtensionContext): Promise<AppMapService> {
  CommandRegistry.setContext(context).addWaitAlias({
    command: 'appmap.explain',
    target: 'appmap.explain.impl',
    message: 'AppMap Navie is launching',
    cancellable: true,
  });

  Telemetry.register(context);

  migrateOpenAIApiKey(context).catch((e) => {
    console.error('Failed to migrate OpenAI API key', e);
  });

  const workspaceServices = initializeWorkspaceServices();
  context.subscriptions.push(workspaceServices);

  const autoIndexServiceImpl = new ProcessServiceImpl();
  const autoScanServiceImpl = new ProcessServiceImpl();

  try {
    const extensionState = new ExtensionState(context);
    context.subscriptions.push(extensionState);

    const uriHandler = new UriHandler();
    const openAppMapUriHandler = new OpenAppMapUriHandler(context);
    uriHandler.registerHandlers(openAppMapUriHandler);
    context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

    const appmapServerAuthenticationProvider = AppMapServerAuthenticationProvider.enroll(
      context,
      uriHandler
    );
    context.subscriptions.push(
      appmapServerAuthenticationProvider.onDidChangeSessions((e) => {
        if (e.added?.length) vscode.window.showInformationMessage('AppMap activated');
        AppMapServerConfiguration.updateAppMapClientConfiguration();
      })
    );

    vscode.commands.registerCommand('appmap.login', async () => {
      appmapServerAuthenticationProvider.createSession([]);
    });
    vscode.commands.registerCommand('appmap.logout', async () => {
      appmapServerAuthenticationProvider.removeSession();
    });

    await SignInManager.register(extensionState);
    const signInWebview = new SignInViewProvider(context, appmapServerAuthenticationProvider);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SignInViewProvider.viewType, signInWebview)
    );

    navieConfigurationService(context);

    const recommender = new AppMapRecommenderService(extensionState);
    await workspaceServices.enroll(recommender);

    AppMapServerConfiguration.enroll(context);

    const appmapCollectionFile = new AppMapCollectionFile();

    const appmapWatcher = new AppMapWatcher();

    let initializing = true;
    context.subscriptions.push(
      appmapWatcher,
      appmapWatcher.onCreate((uri) => {
        appmapCollectionFile.onCreate(uri);
        if (!initializing) checkAndTriggerFirstAppMapNotification(extensionState);
      }),
      appmapWatcher.onDelete((uri) => appmapCollectionFile.onDelete(uri)),
      appmapWatcher.onChange((uri) => appmapCollectionFile.onChange(uri))
    );
    await appmapWatcher.initialize();
    initializing = false;

    await appmapCollectionFile.initialize();

    const configWatcher = new Watcher('**/appmap.yml');
    context.subscriptions.push(configWatcher);

    // Register Quick Review command
    QuickReviewCommand.register(context);

    const configManager = new AppmapConfigManager(configWatcher);
    await workspaceServices.enroll(configManager);

    const classMapIndex = new ClassMapIndex();
    const lineInfoIndex = new LineInfoIndex(classMapIndex);

    deleteAllAppMaps(context, appmapCollectionFile, classMapIndex);

    const classMapWatcher = new Watcher('**/classMap.json');
    context.subscriptions.push(
      classMapWatcher,
      classMapWatcher.onCreate((uri) => {
        classMapIndex.addClassMapFile(uri);
      }),
      classMapWatcher.onChange((uri) => {
        classMapIndex.addClassMapFile(uri);
      }),
      classMapWatcher.onDelete((uri) => {
        classMapIndex.removeClassMapFile(uri);
      })
    );

    context.subscriptions.push(new IndexJanitor(appmapWatcher, classMapWatcher));

    const appmapUptodateService = new AppmapUptodateService(context);
    context.subscriptions.push(appmapUptodateService);
    const sourceFileWatcher = new SourceFileWatcher(classMapIndex);
    context.subscriptions.push(sourceFileWatcher);

    await outOfDateTests(context, appmapUptodateService);
    await openCodeObjectInSource(context);
    await learnMoreRuntimeAnalysis(context);
    appmapHoverProvider(context, lineInfoIndex);

    const activateUptodateService = async () => {
      if (!(appmapUptodateService && sourceFileWatcher)) return;

      // Update the uptodate status whenever a source file or AppMap changes.
      // AppMap deletion does not trigger this.
      const updateUptodate = (uri) => {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) return;
        console.log(`[source-file-watcher] ${uri.fsPath} updated in ${workspaceFolder.name}`);
        assert(appmapUptodateService);
        const uptodateService = workspaceServices.getServiceInstance(
          appmapUptodateService,
          workspaceFolder
        );
        if (uptodateService) uptodateService.update();
      };

      context.subscriptions.push(sourceFileWatcher.onChange(updateUptodate));
      context.subscriptions.push(
        appmapWatcher.onCreate(updateUptodate),
        appmapWatcher.onChange(updateUptodate)
      );

      await workspaceServices.enroll(appmapUptodateService);
    };

    const projectState = new ProjectStateService(
      extensionState,
      configWatcher,
      appmapCollectionFile,
      classMapIndex
    );

    const projectStates = await workspaceServices.enroll(projectState);

    openCodeObjectInAppMap(context, appmapCollectionFile, classMapIndex);

    registerInspectCodeObject(context);

    registerSequenceDiagram(context, appmapCollectionFile);
    registerCompareSequenceDiagrams(context, appmapCollectionFile);

    InstallGuideWebView.register(context, projectStates);

    FindingsOverviewWebview.register(context);
    FindingInfoWebview.register(context);

    const processService = new NodeProcessService(context);

    await ChatCompletion.initialize(context);
    PickCopilotModelCommand.register(context);

    AssetService.register(context);
    const dependenciesInstalled = ExtensionSettings.appMapCommandLineToolsPath
      ? // do not try to download if we're using local tools anyway
        Promise.resolve()
      : AssetService.updateAll();
    const chatSearchWebview: Promise<ChatSearchWebview> = (async () => {
      await dependenciesInstalled;

      activateUptodateService();
      await workspaceServices.enroll(processService);
      installAgent(context);

      const rpcService = await RpcProcessService.create(
        context,
        workspaceServices.getServiceInstances(configManager)
      );

      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
          if (e.affectsConfiguration('appMap.commandLineEnvironment'))
            rpcService.debouncedRestart();
        }),
        vscode.commands.registerCommand('appmap.rpc.restart', async () => {
          await rpcService.restartServer();
          vscode.window.showInformationMessage('Navie restarted successfully.');
        }),
        ChatCompletion.onSettingsChanged(rpcService.debouncedRestart, rpcService)
      );

      const webview = ChatSearchWebview.register(
        context,
        extensionState,
        appmapCollectionFile,
        rpcService
      );

      OpenNavieHistoryCommand.register(context, rpcService);

      return webview;
    })();

    ExtensionSettings.bindContext();

    const trees = registerTrees(
      context,
      appmapCollectionFile,
      classMapIndex,
      appmapUptodateService
    );

    appmapLinkProvider();
    const editorProvider = AppMapEditorProvider.register(context, extensionState);
    RemoteRecording.register(context, workspaceServices);
    ContextMenu.register(context, appmapCollectionFile);

    generateOpenApi(context);
    findByName(context, appmapCollectionFile);

    appmapState(context, editorProvider, chatSearchWebview);
    addToContext(context, chatSearchWebview);
    quickSearch(context);
    resetUsageState(context, extensionState);
    downloadLatestJavaJar(context);
    getAppmapDir(context, workspaceServices);
    clearNavieAiSettings(context);

    // Use this notification to track when the extension is activated.
    if (Environment.isSystemTest) {
      // It may just be a nightly thing, but showErrorMessage has stopped working when called
      // immediately after the extension is activated. This is a workaround.
      const intervalHandle = setInterval(async () => {
        await vscode.window.showErrorMessage('AppMap: Ready', 'OK');
        clearInterval(intervalHandle);
      }, 1000);
    }

    vscode.window.onDidCloseTerminal(unregisterTerminal, null, context.subscriptions);

    await AnalysisManager.register(context);

    if (extensionState.isNewInstall) vscode.commands.executeCommand('appmap.views.signIn.focus');

    return {
      analysisManager: AnalysisManager,
      editorProvider,
      chatSearchWebview,
      localAppMaps: appmapCollectionFile,
      autoIndexService: autoIndexServiceImpl,
      autoScanService: autoScanServiceImpl,
      signInManager: SignInManager,
      sourceFileWatcher,
      workspaceServices,
      uptodate: appmapUptodateService,
      classMap: classMapIndex,
      processService,
      extensionState,
      projectState,
      trees,
      appmapServerAuthenticationProvider,
      recommender,
      configManager,
      commandRegistry: CommandRegistry,
      dependenciesInstalled,
    };
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, {
      exception: exception as Error,
      errorCode: ErrorCode.InitializationFailure,
    });
    throw exception;
  }
}
