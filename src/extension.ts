import * as vscode from 'vscode';

import { AppMapTextEditorProvider } from './textEditor/appmapTextEditorProvider';
import { Telemetry, DEBUG_EXCEPTION, TELEMETRY_ENABLED, PROJECT_OPEN } from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './services/appmapCollectionFile';
import ContextMenu from './tree/contextMenu';
import RemoteRecording from './actions/remoteRecording';
import { notEmpty } from './util';
import { registerUtilityCommands } from './registerUtilityCommands';
import OpenAppMapsWebview from './webviews/openAppmapsWebview';
import ExtensionState from './configuration/extensionState';
import projectPickerWebview from './webviews/projectPickerWebview';
import FindingsIndex from './services/findingsIndex';
import FindingsDiagnosticsProvider from './diagnostics/findingsDiagnosticsProvider';
import extensionSettings from './configuration/extensionSettings';
import { FindingsTreeDataProvider } from './tree/findingsTreeDataProvider';
import WorkspaceServices from './services/workspaceServices';
import { AppMapWatcher } from './services/appmapWatcher';
import AutoIndexerService from './services/autoIndexer';
import AutoScannerService from './services/autoScanner';
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
import { AppmapUptodateService } from './services/appmapUptodateService';
import outOfDateTests from './commands/outOfDateTests';
import appmapLinkProvider from './terminalLink/appmapLinkProvider';
import { initializeWorkspaceServices } from './services/workspaceServices';

export async function activate(context: vscode.ExtensionContext): Promise<AppMapService> {
  const workspaceServices = new WorkspaceServices(context);
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
      classMapIndex: ClassMapIndex | undefined,
      lineInfoIndex: LineInfoIndex | undefined,
      projectStates: ProjectStateServiceInstance[] = [],
      appmapUptodateService: AppmapUptodateService | undefined;

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
    const indexEnabled = findingsEnabled || extensionSettings.indexEnabled();

    if (indexEnabled) {
      classMapIndex = new ClassMapIndex();
      lineInfoIndex = new LineInfoIndex(classMapIndex);

      appmapUptodateService = new AppmapUptodateService();

      const classMapProvider = new ClassMapTreeDataProvider(classMapIndex);
      vscode.window.createTreeView('appmap.views.codeObjects', {
        treeDataProvider: classMapProvider,
      });

      registerDecorationProvider(context, lineInfoIndex);
      outOfDateTests(context, appmapUptodateService);
      openCodeObjectInAppMap(context, classMapIndex);
      appmapHoverProvider(context, lineInfoIndex);

      const classMapWatcher = new ClassMapWatcher({
        onCreate: classMapIndex.addClassMapFile.bind(classMapIndex),
        onChange: classMapIndex.addClassMapFile.bind(classMapIndex),
        onDelete: classMapIndex.removeClassMapFile.bind(classMapIndex),
      });

      {
        const autoIndexService = new AutoIndexerService();
        autoIndexService.on('invoke', (command) => autoIndexServiceImpl.startInvocation(command));
        autoIndexService.on('message', (message) => autoIndexServiceImpl.addMessage(message));
        autoIndexService.on('exit', (exitStatus) => autoIndexServiceImpl.endInvocation(exitStatus));
        await workspaceServices.enroll(autoIndexService);
      }

      await workspaceServices.enroll(appmapUptodateService);
      await workspaceServices.enroll(classMapWatcher);
    }

    if (findingsEnabled) {
      findingsIndex = new FindingsIndex();

      const findingsDiagnosticsProvider = new FindingsDiagnosticsProvider(context);
      findingsIndex.on('added', (uri: vscode.Uri, findings: ResolvedFinding[]) =>
        findingsDiagnosticsProvider.updateFindings(uri, findings)
      );
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

      const autoScannerService = new AutoScannerService();
      {
        autoScannerService.on('invoke', (command) => autoScanServiceImpl.startInvocation(command));
        autoScannerService.on('message', (message) => autoScanServiceImpl.addMessage(message));
        autoScannerService.on('exit', (exitStatus) =>
          autoScanServiceImpl.endInvocation(exitStatus)
        );
      }
      await workspaceServices.enroll(autoScannerService);
      await workspaceServices.enroll(findingWatcher);
    }

    const inspectEnabled = extensionSettings.inspectEnabled();
    if (inspectEnabled) {
      registerInspectCodeObject(context);
    }

    {
      const projectState = new ProjectStateService(
        extensionState,
        appmapWatcher,
        configWatcher,
        appmapCollectionFile,
        findingsIndex
      );

      projectStates = (await workspaceServices.enroll(
        projectState
      )) as ProjectStateServiceInstance[];

      if (extensionSettings.instructionsEnabled()) {
        const badge = new InstallationStatusBadge('appmap.views.instructions');
        badge.initialize(projectStates);
        context.subscriptions.push(badge);

        InstallGuideWebView.register(context, projectStates);
      }
    }

    deleteAllAppMaps(context, classMapIndex, findingsIndex);

    registerTrees(context, appmapCollectionFile, projectStates, appmapUptodateService);

    (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder) => {
      Telemetry.sendEvent(PROJECT_OPEN, { rootDirectory: workspaceFolder.uri.fsPath });
    });

    appmapLinkProvider();
    AppMapTextEditorProvider.register(context, extensionState);
    RemoteRecording.register(context);
    ContextMenu.register(context);
    projectPickerWebview(context, extensionState);
    OpenAppMapsWebview.register(context, appmapCollectionFile);

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

    context.subscriptions.push(
      vscode.window.registerUriHandler({
        handleUri(uri: vscode.Uri) {
          if (uri.path === '/open') {
            const queryParams = new URLSearchParams(uri.query);

            if (queryParams.get('uri')) {
              vscode.commands.executeCommand(
                'vscode.open',
                vscode.Uri.parse(queryParams.get('uri') as string)
              );
            }

            if (queryParams.get('state')) {
              context.globalState.update(
                AppMapTextEditorProvider.INITIAL_STATE,
                queryParams.get('state')
              );
            }
          }
        },
      })
    );

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
      localAppMaps: appmapCollectionFile,
      autoIndexService: autoIndexServiceImpl,
      autoScanService: autoScanServiceImpl,
      findings: findingsIndex,
      classMap: classMapIndex,
      uptodateService: appmapUptodateService,
    };
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: exception as Error });
    throw exception;
  }
}
