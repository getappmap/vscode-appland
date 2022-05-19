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
import registerHoverProvider from './hover/hoverProvider';
import registerInspectCodeObject from './commands/inspectCodeObject';
import openCodeObjectInAppMap from './commands/openCodeObjectInAppMap';

export async function activate(context: vscode.ExtensionContext): Promise<AppMapService> {
  const workspaceServices = new WorkspaceServices(context);
  Telemetry.register(context);

  try {
    const properties = new ExtensionState(context);
    if (properties.isNewInstall) {
      Telemetry.reportAction('plugin:install');
    }

    const appmapCollectionFile = new AppMapCollectionFile();
    let findingsIndex: FindingsIndex | undefined,
      classMapIndex: ClassMapIndex | undefined,
      lineInfoIndex: LineInfoIndex | undefined;

    {
      const appmapWatcher = new AppMapWatcher({
        onCreate: appmapCollectionFile.onCreate.bind(appmapCollectionFile),
        onDelete: appmapCollectionFile.onDelete.bind(appmapCollectionFile),
        onChange: appmapCollectionFile.onChange.bind(appmapCollectionFile),
      });
      await workspaceServices.enroll(appmapWatcher);
      await appmapCollectionFile.initialize();
    }

    const findingsEnabled = extensionSettings.findingsEnabled();
    if (findingsEnabled) {
      classMapIndex = new ClassMapIndex();
      findingsIndex = new FindingsIndex();
      lineInfoIndex = new LineInfoIndex(findingsIndex, classMapIndex);

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

      const classMapProvider = new ClassMapTreeDataProvider(classMapIndex);
      vscode.window.createTreeView('appmap.views.codeObjects', {
        treeDataProvider: classMapProvider,
      });

      openCodeObjectInAppMap(context, classMapIndex);
      registerDecorationProvider(context, lineInfoIndex);
      registerHoverProvider(context, lineInfoIndex);
      registerInspectCodeObject(context);

      const classMapWatcher = new ClassMapWatcher({
        onCreate: classMapIndex.addClassMapFile.bind(classMapIndex),
        onChange: classMapIndex.addClassMapFile.bind(classMapIndex),
        onDelete: classMapIndex.removeClassMapFile.bind(classMapIndex),
      });

      const findingWatcher = new FindingWatcher({
        onCreate: findingsIndex.addFindingsFile.bind(findingsIndex),
        onChange: findingsIndex.addFindingsFile.bind(findingsIndex),
        onDelete: findingsIndex.removeFindingsFile.bind(findingsIndex),
      });

      await workspaceServices.enroll(new AutoIndexerService());
      await workspaceServices.enroll(new AutoScannerService());
      await workspaceServices.enroll(classMapWatcher);
      await workspaceServices.enroll(findingWatcher);
    }

    const { localTree } = registerTrees(context, appmapCollectionFile);

    (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder) => {
      Telemetry.sendEvent(PROJECT_OPEN, { rootDirectory: workspaceFolder.uri.fsPath });
    });

    AppMapTextEditorProvider.register(context, properties);
    RemoteRecording.register(context);
    ContextMenu.register(context);
    projectPickerWebview(context, properties);
    OpenAppMapsWebview.register(context, appmapCollectionFile);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.applyFilter', async () => {
        const filter = await vscode.window.showInputBox({
          placeHolder:
            'Enter a case sensitive partial match or leave this input empty to clear an existing filter',
        });

        appmapCollectionFile.setFilter(filter || '');
        localTree.reveal(appmapCollectionFile.appMaps[0], { select: false });
      })
    );

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

    registerUtilityCommands(context, properties);

    vscode.env.onDidChangeTelemetryEnabled((enabled: boolean) => {
      Telemetry.sendEvent(TELEMETRY_ENABLED, {
        enabled,
      });
    });

    return {
      localAppMaps: appmapCollectionFile,
      findings: findingsIndex,
      classMap: classMapIndex,
    };
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: exception as Error });
    throw exception;
  }
}
