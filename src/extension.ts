import * as vscode from 'vscode';

import AppMapEditorProvider from './editor/appmapEditorProvider';
import { Telemetry, DEBUG_EXCEPTION, TELEMETRY_ENABLED, PROJECT_OPEN } from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './services/appmapCollectionFile';
import ContextMenu from './tree/contextMenu';
import RemoteRecording from './actions/remoteRecording';
import { notEmpty } from './util';
import { registerUtilityCommands } from './registerUtilityCommands';
import ExtensionState from './configuration/extensionState';
import FindingsIndex from './services/findingsIndex';
import FindingsDiagnosticsProvider from './diagnostics/findingsDiagnosticsProvider';
import extensionSettings from './configuration/extensionSettings';
import { FindingsTreeDataProvider } from './tree/findingsTreeDataProvider';
import { AppMapWatcher } from './services/appmapWatcher';
import { FindingWatcher } from './services/findingWatcher';
import ClassMapIndex from './services/classMapIndex';
import { ClassMapWatcher } from './services/classMapWatcher';
import { ClassMapTreeDataProvider } from './tree/classMapTreeDataProvider';
import { ResolvedFinding } from './services/resolvedFinding';
import AppMapService from './appMapService';
import LineInfoIndex from './services/lineInfoIndex';
import registerDecorationProvider from './decorations/decorationProvider';
import appmapHoverProvider from './hover/appmapHoverProvider';
import registerInspectCodeObject from './commands/inspectCodeObject';
import openCodeObjectInAppMap from './commands/openCodeObjectInAppMap';
import ProcessServiceImpl from './processServiceImpl';
import deleteAllAppMaps from './commands/deleteAllAppMaps';
import InstallGuideWebView from './webviews/installGuideWebview';
import InstallationStatusBadge from './workspace/installationStatus';
import { AppMapConfigWatcher } from './services/appMapConfigWatcher';
import ProjectStateService, { ProjectStateServiceInstance } from './services/projectStateService';
import AppmapUptodateServiceInstance, {
  AppmapUptodateService,
} from './services/appmapUptodateService';
import outOfDateTests from './commands/outOfDateTests';
import appmapLinkProvider from './terminalLink/appmapLinkProvider';
import { SourceFileWatcher } from './services/sourceFileWatcher';
import assert from 'assert';
import { initializeWorkspaceServices } from './services/workspaceServices';
import { NodeProcessService } from './services/nodeProcessService';
import getEarlyAccess from './commands/getEarlyAccess';
import openFinding from './commands/openFinding';
import { RuntimeAnalysisCtaService } from './services/runtimeAnalysisCtaService';
import UriHandler from './uri/uriHandler';
import AuthenticateSlackUriHandler from './uri/authenticateSlackUriHandler';
import OpenAppMapUriHandler from './uri/openAppMapUriHandler';
import AuthenticationProvider from './authentication/authenticationProvider';

export async function activate(context: vscode.ExtensionContext): Promise<AppMapService> {
  Telemetry.register(context);

  const workspaceServices = initializeWorkspaceServices(context);
  const autoIndexServiceImpl = new ProcessServiceImpl();
  const autoScanServiceImpl = new ProcessServiceImpl();

  try {
    const extensionState = new ExtensionState(context);
    context.subscriptions.push(extensionState);

    if (extensionState.isNewInstall) {
      Telemetry.reportAction('plugin:install');
    }

    const appmapCollectionFile = new AppMapCollectionFile();
    let findingsIndex: FindingsIndex | undefined,
      projectStates: ProjectStateServiceInstance[] = [];

    const appmapWatcher = new AppMapWatcher();
    context.subscriptions.push(
      appmapWatcher.onCreate(({ uri }) => appmapCollectionFile.onCreate(uri)),
      appmapWatcher.onDelete(({ uri }) => appmapCollectionFile.onDelete(uri)),
      appmapWatcher.onChange(({ uri }) => appmapCollectionFile.onChange(uri))
    );

    await workspaceServices.enroll(appmapWatcher);
    await appmapCollectionFile.initialize();

    const configWatcher = new AppMapConfigWatcher();
    await workspaceServices.enroll(configWatcher);

    const findingsEnabled = extensionSettings.findingsEnabled();

    const classMapIndex = new ClassMapIndex();
    const lineInfoIndex = new LineInfoIndex(classMapIndex);

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

    if (findingsEnabled) {
      findingsIndex = new FindingsIndex();

      const findingsDiagnosticsProvider = new FindingsDiagnosticsProvider(context);
      findingsIndex.on('added', (uri: vscode.Uri, findings: ResolvedFinding[]) => {
        findingsDiagnosticsProvider.updateFindings(uri, findings);
        vscode.commands.executeCommand('setContext', 'appmap.numFindings', findings.length);
      });
      findingsIndex.on('removed', (uri: vscode.Uri) =>
        findingsDiagnosticsProvider.updateFindings(uri, [])
      );

      const findingsTreeProvider = new FindingsTreeDataProvider(findingsIndex);
      vscode.window.createTreeView('appmap.views.findings', {
        treeDataProvider: findingsTreeProvider,
      });

      const findingWatcher = new FindingWatcher();
      context.subscriptions.push(
        findingWatcher.onCreate(({ uri, workspaceFolder }) => {
          findingsIndex?.addFindingsFile(uri, workspaceFolder);
        }),
        findingWatcher.onChange(({ uri, workspaceFolder }) => {
          findingsIndex?.addFindingsFile(uri, workspaceFolder);
        }),
        findingWatcher.onDelete(({ uri, workspaceFolder }) => {
          findingsIndex?.removeFindingsFile(uri, workspaceFolder);
        })
      );

      await workspaceServices.enroll(findingWatcher);
    }

    const inspectEnabled = extensionSettings.inspectEnabled();
    if (inspectEnabled) {
      registerInspectCodeObject(context);
    }

    let processService: NodeProcessService | undefined;
    let runtimeAnalysisCta: RuntimeAnalysisCtaService | undefined;
    let projectState: ProjectStateService;
    {
      projectState = new ProjectStateService(
        extensionState,
        appmapWatcher,
        configWatcher,
        appmapCollectionFile,
        classMapIndex,
        findingsIndex
      );

      projectStates = (await workspaceServices.enroll(
        projectState
      )) as ProjectStateServiceInstance[];

      const badge = new InstallationStatusBadge('appmap.views.instructions');
      badge.initialize(projectStates);
      context.subscriptions.push(badge);

      InstallGuideWebView.register(context, projectStates, extensionState);
      InstallGuideWebView.tryOpen(extensionState);

      processService = new NodeProcessService(context, projectStates);
      // The node dependencies may take some time to retrieve. As a result, the initialization sequence is
      // wrapped in an async function but we won't wait for it to resolve.
      (async function() {
        processService.onReady(activateUptodateService);
        await processService.install();
        await workspaceServices.enroll(processService);
      })();

      runtimeAnalysisCta = new RuntimeAnalysisCtaService(projectStates, extensionState);
      await workspaceServices.enroll(runtimeAnalysisCta);
    }

    deleteAllAppMaps(context, classMapIndex, findingsIndex);

    registerTrees(context, appmapCollectionFile, projectStates, appmapUptodateService);

    if (findingsEnabled) {
      openFinding(context, projectStates, extensionState);
    }

    (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder) => {
      Telemetry.sendEvent(PROJECT_OPEN, { rootDirectory: workspaceFolder.uri.fsPath });
    });

    appmapLinkProvider();
    const editorProvider = AppMapEditorProvider.register(context, extensionState);
    RemoteRecording.register(context);
    ContextMenu.register(context);
    getEarlyAccess(context, extensionState);

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

    const uriHandler = new UriHandler();
    const authenicateSlackUriHandler = new AuthenticateSlackUriHandler();
    const openAppMapUriHandler = new OpenAppMapUriHandler(context);
    uriHandler.registerHandlers(authenicateSlackUriHandler, openAppMapUriHandler);
    context.subscriptions.push(vscode.window.registerUriHandler(uriHandler));

    const authnProviderSlack = new AuthenticationProvider({
      provider: 'slack',
      label: 'AppMap Community Slack',
      authUrl: 'https://slack-app.appland.com/oauth/inbound/vscode',
      context,
    });

    context.subscriptions.push(
      vscode.authentication.registerAuthenticationProvider(
        'appland.appmap.slack',
        'AppMap Community Slack',
        authnProviderSlack,
        { supportsMultipleAccounts: true }
      )
    );

    vscode.authentication.getSession('appland.appmap.slack', []);

    registerUtilityCommands(context, extensionState);

    vscode.env.onDidChangeTelemetryEnabled((enabled: boolean) => {
      Telemetry.sendEvent(TELEMETRY_ENABLED, {
        enabled,
      });
    });

    // Use this notification to track when the extension is activated.
    if (process.env.APPMAP_TEST) {
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
      findings: findingsIndex,
      classMap: classMapIndex,
      processService,
      extensionState,
      runtimeAnalysisCta,
      projectState,
    };
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: exception as Error });
    throw exception;
  }
}
