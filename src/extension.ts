import * as vscode from 'vscode';

import assert from 'assert';
import RemoteRecording from './actions/remoteRecording';
import AppMapService from './appMapService';
import deleteAllAppMaps from './commands/deleteAllAppMaps';
import getEarlyAccess from './commands/getEarlyAccess';
import registerInspectCodeObject from './commands/inspectCodeObject';
import openCodeObjectInAppMap from './commands/openCodeObjectInAppMap';
import outOfDateTests from './commands/outOfDateTests';
import extensionSettings from './configuration/extensionSettings';
import ExtensionState from './configuration/extensionState';
import registerDecorationProvider from './decorations/decorationProvider';
import AppMapEditorProvider from './editor/appmapEditorProvider';
import appmapHoverProvider from './hover/appmapHoverProvider';
import ProcessServiceImpl from './processServiceImpl';
import { registerUtilityCommands } from './registerUtilityCommands';
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
import { RuntimeAnalysisCtaService } from './services/runtimeAnalysisCtaService';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import { initializeWorkspaceServices } from './services/workspaceServices';
import {
  DEBUG_EXCEPTION,
  PROJECT_OPEN,
  Telemetry,
  TELEMETRY_ENABLED,
  sendAppMapCreateEvent,
} from './telemetry';
import appmapLinkProvider from './terminalLink/appmapLinkProvider';
import registerTrees from './tree';
import { ClassMapTreeDataProvider } from './tree/classMapTreeDataProvider';
import ContextMenu from './tree/contextMenu';
import { FindingsTreeDataProvider } from './tree/findingsTreeDataProvider';
import { notEmpty } from './util';
import InstallGuideWebView from './webviews/installGuideWebview';
import InstallationStatusBadge from './workspace/installationStatus';
import UriHandler from './uri/uriHandler';
import OpenAppMapUriHandler from './uri/openAppMapUriHandler';
import EarlyAccessUriHandler, { tryDisplayEarlyAccessWelcome } from './uri/earlyAccessUriHandler';
import generateOpenApi from './commands/generateOpenApi';
import AppMapServerConfiguration from './services/appmapServerConfiguration';
import AppMapServerAuthenticationProvider from './authentication/appmapServerAuthenticationProvider';
import installAgent from './commands/installAgent';
import { Signup } from './actions/signup';
import AnalysisManager from './services/analysisManager';
import { FindingsService } from './findingsService';
import Environment from './configuration/environment';

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

    AppMapServerConfiguration.enroll(context);

    const appmapCollectionFile = new AppMapCollectionFile();

    const appmapWatcher = new AppMapWatcher();
    context.subscriptions.push(
      appmapWatcher.onCreate(({ uri }) => appmapCollectionFile.onCreate(uri)),
      appmapWatcher.onCreate(({ uri, workspaceFolder }) =>
        sendAppMapCreateEvent(uri, workspaceFolder)
      ),
      appmapWatcher.onDelete(({ uri }) => appmapCollectionFile.onDelete(uri)),
      appmapWatcher.onChange(({ uri }) => appmapCollectionFile.onChange(uri))
    );

    await workspaceServices.enroll(appmapWatcher);
    await appmapCollectionFile.initialize();

    const configWatcher = new AppMapConfigWatcher();
    await workspaceServices.enroll(configWatcher);

    const classMapIndex = new ClassMapIndex();
    const lineInfoIndex = new LineInfoIndex(classMapIndex);

    deleteAllAppMaps(context, classMapIndex);

    const classMapProvider = new ClassMapTreeDataProvider(classMapIndex);
    const codeObjectsTree = vscode.window.createTreeView('appmap.views.codeObjects', {
      treeDataProvider: classMapProvider,
    });

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.view.focusCodeObjects', () => {
        codeObjectsTree.reveal(undefined, { expand: true, focus: true, select: true });
      })
    );

    const classMapWatcher = new ClassMapWatcher({
      onCreate: classMapIndex.addClassMapFile.bind(classMapIndex),
      onChange: classMapIndex.addClassMapFile.bind(classMapIndex),
      onDelete: classMapIndex.removeClassMapFile.bind(classMapIndex),
    });

    const appmapUptodateService = new AppmapUptodateService(context);
    const sourceFileWatcher = new SourceFileWatcher(classMapIndex);

    registerDecorationProvider(context, lineInfoIndex);
    outOfDateTests(context, appmapUptodateService);
    openCodeObjectInAppMap(context, classMapIndex);
    appmapHoverProvider(context, lineInfoIndex);

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
        ) as AppmapUptodateServiceInstance | undefined;
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
    const earlyAccessUriHandler = new EarlyAccessUriHandler(context);
    uriHandler.registerHandlers(openAppMapUriHandler, earlyAccessUriHandler);
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

    const findingsTreeProvider = new FindingsTreeDataProvider(context);
    vscode.window.createTreeView('appmap.views.findings', {
      treeDataProvider: findingsTreeProvider,
    });
    context.subscriptions.push(findingsTreeProvider);

    const inspectEnabled = extensionSettings.inspectEnabled;
    if (inspectEnabled) {
      registerInspectCodeObject(context);
    }

    const projectState = new ProjectStateService(
      extensionState,
      appmapWatcher,
      configWatcher,
      appmapCollectionFile,
      classMapIndex
    );

    const projectStates = (await workspaceServices.enroll(
      projectState
    )) as ProjectStateServiceInstance[];

    AnalysisManager.register(context, projectStates, extensionState, workspaceServices);

    const badge = new InstallationStatusBadge('appmap.views.instructions');
    badge.initialize(projectStates);
    context.subscriptions.push(badge);

    vscode.commands.registerCommand('appmap.enableAnalysis', () => Signup.forAnalysis());

    tryDisplayEarlyAccessWelcome(context);

    InstallGuideWebView.register(context, projectStates, extensionState);
    InstallGuideWebView.tryOpen(extensionState);

    const processService = new NodeProcessService(context, projectStates);
    (async function() {
      processService.onReady(activateUptodateService);
      await processService.install();
      await workspaceServices.enroll(processService);
      installAgent(context, processService.hasCLIBin);
    })();

    const runtimeAnalysisCta = new RuntimeAnalysisCtaService(projectStates, extensionState);
    await workspaceServices.enroll(runtimeAnalysisCta);

    const trees = registerTrees(
      context,
      appmapCollectionFile,
      projectStates,
      appmapUptodateService
    );

    (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder) => {
      Telemetry.sendEvent(PROJECT_OPEN, { rootDirectory: workspaceFolder.uri.fsPath });
    });

    appmapLinkProvider();
    const editorProvider = AppMapEditorProvider.register(context, extensionState);
    RemoteRecording.register(context);
    ContextMenu.register(context);
    getEarlyAccess(context, extensionState);
    generateOpenApi(context, extensionState);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.findByName', async () => {
        const items = appmapCollectionFile
          .allAppMaps()
          .map((loader) => loader.descriptor.metadata?.name as string)
          .filter(notEmpty)
          .sort();

        const name = await vscode.window.showQuickPick(items, {});
        if (!name) {
          return;
        }

        const loader = appmapCollectionFile.findByName(name);
        if (!loader) {
          return;
        }

        vscode.commands.executeCommand('vscode.open', loader.descriptor.resourceUri);
      })
    );

    registerUtilityCommands(context, extensionState);

    vscode.env.onDidChangeTelemetryEnabled((enabled: boolean) => {
      Telemetry.sendEvent(TELEMETRY_ENABLED, {
        enabled,
      });
    });

    // Use this notification to track when the extension is activated.
    if (Environment.isSmokeTest) {
      // It may just be a nightly thing, but showErrorMessage has stopped working when called
      // immediately after the extension is activated. This is a workaround.
      const intervalHandle = setInterval(async () => {
        await vscode.window.showErrorMessage('AppMap: Ready', 'OK');
        clearInterval(intervalHandle);
      }, 1000);
    }

    return {
      editorProvider,
      localAppMaps: appmapCollectionFile,
      autoIndexService: autoIndexServiceImpl,
      autoScanService: autoScanServiceImpl,
      sourceFileWatcher,
      configWatcher,
      workspaceServices,
      uptodate: appmapUptodateService,
      classMap: classMapIndex,
      processService,
      extensionState,
      runtimeAnalysisCta,
      projectState,
      trees,
      appmapServerAuthenticationProvider,
      get findings(): FindingsService | undefined {
        return AnalysisManager.findingsIndex;
      },
    };
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: exception as Error });
    throw exception;
  }
}
