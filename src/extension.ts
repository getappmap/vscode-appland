import * as vscode from 'vscode';

import assert from 'assert';
import RemoteRecording from './actions/remoteRecording';
import AppMapService from './appMapService';
import deleteAllAppMaps from './commands/deleteAllAppMaps';
import registerInspectCodeObject from './commands/inspectCodeObject';
import registerSequenceDiagram from './commands/sequenceDiagram';
import registerCompareSequenceDiagrams from './commands/compareSequenceDiagram';
import openCodeObjectInAppMap from './commands/openCodeObjectInAppMap';
import outOfDateTests from './commands/outOfDateTests';
import ExtensionState from './configuration/extensionState';
import registerDecorationProvider from './decorations/decorationProvider';
import AppMapEditorProvider from './editor/appmapEditorProvider';
import appmapHoverProvider from './hover/appmapHoverProvider';
import ProcessServiceImpl from './processServiceImpl';
import { resetUsageState } from './commands/resetUsageState';
import AppMapCollectionFile from './services/appmapCollectionFile';
import { AppMapConfigWatcher } from './services/appMapConfigWatcher';
import AppmapUptodateServiceInstance, {
  AppmapUptodateService,
} from './services/appmapUptodateService';
import { AppMapWatcher } from './services/appmapWatcher';
import ClassMapIndex from './services/classMapIndex';
import { ClassMapWatcher } from './services/classMapWatcher';
import LineInfoIndex from './services/lineInfoIndex';
import { NodeProcessService } from './services/nodeProcessService';
import ProjectStateService, { ProjectStateServiceInstance } from './services/projectStateService';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import { initializeWorkspaceServices } from './services/workspaceServices';
import { DEBUG_EXCEPTION, Telemetry, TELEMETRY_ENABLED, sendAppMapCreateEvent } from './telemetry';
import appmapLinkProvider from './terminalLink/appmapLinkProvider';
import registerTrees from './tree';
import { ClassMapTreeDataProvider } from './tree/classMapTreeDataProvider';
import ContextMenu from './tree/contextMenu';
import InstallGuideWebView from './webviews/installGuideWebview';
import InstallationStatusBadge from './workspace/installationStatus';
import UriHandler from './uri/uriHandler';
import OpenAppMapUriHandler from './uri/openAppMapUriHandler';
import generateOpenApi from './commands/generateOpenApi';
import AppMapServerConfiguration from './services/appmapServerConfiguration';
import AppMapServerAuthenticationProvider from './authentication/appmapServerAuthenticationProvider';
import installAgent from './commands/installAgent';
import AnalysisManager from './services/analysisManager';
import Environment from './configuration/environment';
import ErrorCode from './telemetry/definitions/errorCodes';
import promptInstall from './actions/promptInstall';
import FindingsOverviewWebview from './webviews/findingsWebview';
import FindingInfoWebview from './webviews/findingInfoWebview';
import { AppMapRecommenderService } from './services/appmapRecommenderService';
import openCodeObjectInSource from './commands/openCodeObjectInSource';
import learnMoreRuntimeAnalysis from './commands/learnMoreRuntimeAnalysis';
import SignInViewProvider from './webviews/signInWebview';
import SignInManager from './services/signInManager';
import tryOpenInstallGuide from './commands/tryOpenInstallGuide';
import { AppmapConfigManager } from './services/appmapConfigManager';
import { findByName } from './commands/findByName';
import { RunConfigService } from './services/runConfigService';
import updateAppMapConfigs from './commands/updateConfigs';
import downloadLatestJavaJar from './commands/downloadLatestJavaJar';
import IndexJanitor from './lib/indexJanitor';
import { unregister as unregisterTerminal } from './commands/installer/terminals';
import getAppmapDir from './commands/getAppmapDir';
import JavaAssets from './services/javaAssets';
import createJavaConfigurationCommand from './commands/createJavaConfiguration';

export async function activate(context: vscode.ExtensionContext): Promise<AppMapService> {
  Telemetry.register(context);

  const workspaceServices = initializeWorkspaceServices();
  context.subscriptions.push(workspaceServices);

  const autoIndexServiceImpl = new ProcessServiceImpl();
  const autoScanServiceImpl = new ProcessServiceImpl();

  try {
    const extensionState = new ExtensionState(context);
    context.subscriptions.push(extensionState);

    if (extensionState.isNewInstall) {
      Telemetry.reportAction('plugin:install');
    }
    const recommender = new AppMapRecommenderService(extensionState);
    await workspaceServices.enroll(recommender);

    AppMapServerConfiguration.enroll(context);

    const appmapCollectionFile = new AppMapCollectionFile();

    const appmapWatcher = new AppMapWatcher();
    context.subscriptions.push(
      appmapWatcher.onCreate(({ uri, workspaceFolder, initializing }) => {
        appmapCollectionFile.onCreate(uri);
        if (!initializing) sendAppMapCreateEvent(uri, workspaceFolder);
      }),
      appmapWatcher.onDelete(({ uri }) => appmapCollectionFile.onDelete(uri)),
      appmapWatcher.onChange(({ uri }) => appmapCollectionFile.onChange(uri))
    );

    await workspaceServices.enroll(appmapWatcher);
    await appmapCollectionFile.initialize();

    const configWatcher = new AppMapConfigWatcher();
    await workspaceServices.enroll(configWatcher);

    const configManager = new AppmapConfigManager();
    await workspaceServices.enroll(configManager);

    const classMapIndex = new ClassMapIndex();
    const lineInfoIndex = new LineInfoIndex(classMapIndex);

    deleteAllAppMaps(context, appmapCollectionFile, classMapIndex);

    const classMapProvider = new ClassMapTreeDataProvider(classMapIndex);
    const codeObjectsTree = vscode.window.createTreeView('appmap.views.codeObjects', {
      treeDataProvider: classMapProvider,
    });

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.view.focusCodeObjects', () => {
        codeObjectsTree.reveal(undefined, { expand: true, focus: true, select: true });
      })
    );

    const classMapWatcher = new ClassMapWatcher();
    context.subscriptions.push(
      // TODO: workspaceFolder is available for these three events as well, if you want to use it.
      classMapWatcher.onCreate(({ uri }) => {
        classMapIndex.addClassMapFile(uri);
      }),
      classMapWatcher.onChange(({ uri }) => {
        classMapIndex.addClassMapFile(uri);
      }),
      classMapWatcher.onDelete(({ uri }) => {
        classMapIndex.removeClassMapFile(uri);
      })
    );

    context.subscriptions.push(new IndexJanitor(appmapWatcher, classMapWatcher));
    context.subscriptions.push(createJavaConfigurationCommand());

    const appmapUptodateService = new AppmapUptodateService(context);
    const sourceFileWatcher = new SourceFileWatcher(classMapIndex);

    registerDecorationProvider(context, lineInfoIndex);
    await outOfDateTests(context, appmapUptodateService);
    await openCodeObjectInSource(context);
    await learnMoreRuntimeAnalysis(context);
    appmapHoverProvider(context, lineInfoIndex);
    tryOpenInstallGuide(extensionState);

    await workspaceServices.enroll(sourceFileWatcher);
    await workspaceServices.enroll(classMapWatcher);

    const activateUptodateService = async () => {
      if (!(appmapUptodateService && sourceFileWatcher)) return;

      // Update the uptodate status whenever a source file or AppMap changes.
      // AppMap deletion does not trigger this.
      const updateUptodate = ({ uri, workspaceFolder }) => {
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

    const uriHandler = new UriHandler();
    const openAppMapUriHandler = new OpenAppMapUriHandler(context);
    uriHandler.registerHandlers(openAppMapUriHandler);
    context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

    const appmapServerAuthenticationProvider = AppMapServerAuthenticationProvider.enroll(
      context,
      uriHandler
    );
    appmapServerAuthenticationProvider.onDidChangeSessions((e) => {
      if (e.added) vscode.window.showInformationMessage('Logged in to AppMap Server');
      if (e.removed) vscode.window.showInformationMessage('Logged out of AppMap Server');
      AppMapServerConfiguration.updateAppMapClientConfiguration();
    });
    vscode.commands.registerCommand('appmap.login', async () => {
      appmapServerAuthenticationProvider.createSession();
    });
    vscode.commands.registerCommand('appmap.logout', async () => {
      appmapServerAuthenticationProvider.removeSession();
    });

    const projectState = new ProjectStateService(
      extensionState,
      configWatcher,
      appmapCollectionFile,
      classMapIndex
    );

    const projectStates = await workspaceServices.enroll(projectState);

    openCodeObjectInAppMap(context, appmapCollectionFile, classMapIndex);

    await SignInManager.register(extensionState);
    const signInWebview = new SignInViewProvider(context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SignInViewProvider.viewType, signInWebview)
    );

    registerInspectCodeObject(context);

    registerSequenceDiagram(context, appmapCollectionFile);
    registerCompareSequenceDiagrams(context, appmapCollectionFile);

    const badge = new InstallationStatusBadge('appmap.views.instructions');
    badge.initialize(projectStates);
    context.subscriptions.push(badge);

    InstallGuideWebView.register(context, projectStates, extensionState);
    const openedInstallGuide = await vscode.commands.executeCommand('appmap.tryOpenInstallGuide');

    FindingsOverviewWebview.register(context);
    FindingInfoWebview.register(context);

    const processService = new NodeProcessService(context);
    const runConfigService = new RunConfigService(projectState, workspaceServices, extensionState);

    context.subscriptions.push(JavaAssets);
    JavaAssets.installLatestJavaJar(false);

    await workspaceServices.enroll(runConfigService);

    (async function () {
      processService.onReady(activateUptodateService);
      await processService.install();
      await workspaceServices.enroll(processService);
      installAgent(context, processService.hasCLIBin);
    })();

    const trees = registerTrees(
      context,
      appmapCollectionFile,
      projectStates,
      appmapUptodateService
    );

    appmapLinkProvider();
    const editorProvider = AppMapEditorProvider.register(context, extensionState);
    RemoteRecording.register(context, workspaceServices);
    ContextMenu.register(context, appmapCollectionFile);

    generateOpenApi(context, extensionState);
    findByName(context, appmapCollectionFile);
    resetUsageState(context, extensionState);
    updateAppMapConfigs(context, runConfigService, workspaceServices);
    downloadLatestJavaJar(context);
    getAppmapDir(context, workspaceServices);

    if (!openedInstallGuide && !SignInManager.shouldShowSignIn())
      promptInstall(workspaceServices, extensionState);

    vscode.env.onDidChangeTelemetryEnabled((enabled: boolean) => {
      Telemetry.sendEvent(TELEMETRY_ENABLED, {
        enabled,
      });
    });

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

    await AnalysisManager.register(context, projectStates, extensionState, workspaceServices);

    if (extensionState.isNewInstall) vscode.commands.executeCommand('appmap.views.signIn.focus');

    return {
      analysisManager: AnalysisManager,
      editorProvider,
      localAppMaps: appmapCollectionFile,
      autoIndexService: autoIndexServiceImpl,
      autoScanService: autoScanServiceImpl,
      signInManager: SignInManager,
      sourceFileWatcher,
      configWatcher,
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
      runConfigService,
    };
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, {
      exception: exception as Error,
      errorCode: ErrorCode.InitializationFailure,
    });
    throw exception;
  }
}
