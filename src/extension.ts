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

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceServices = new WorkspaceServices(context);
  Telemetry.register(context);

  try {
    const properties = new ExtensionState(context);
    if (properties.isNewInstall) {
      Telemetry.reportAction('plugin:install');
    }

    const appmapCollectionFile = new AppMapCollectionFile();
    let findingsIndex: FindingsIndex;

    {
      const appmapWatcher = new AppMapWatcher({
        onCreate: appmapCollectionFile.onCreate.bind(appmapCollectionFile),
        onDelete: appmapCollectionFile.onDelete.bind(appmapCollectionFile),
        onChange: appmapCollectionFile.onChange.bind(appmapCollectionFile),
      });
      workspaceServices.enroll(appmapWatcher);
    }

    const findingsEnabled = extensionSettings.findingsEnabled();
    {
      if (findingsEnabled) {
        workspaceServices.enroll(new AutoIndexerService());
        workspaceServices.enroll(new AutoScannerService());
      }
    }

    AppMapTextEditorProvider.register(context, properties);
    RemoteRecording.register(context);
    ContextMenu.register(context);

    projectPickerWebview(context, properties);

    OpenAppMapsWebview.register(context, appmapCollectionFile);

    if (findingsEnabled) {
      findingsIndex = new FindingsIndex();

      const findingsDiagnosticsProvider = new FindingsDiagnosticsProvider();
      findingsIndex.onChanged((uri: vscode.Uri) =>
        findingsDiagnosticsProvider.updateFindings(uri, findingsIndex.findingsForUri(uri))
      );
      const findingsTreeProvider = new FindingsTreeDataProvider(findingsIndex);
      vscode.window.createTreeView('appmap.views.findings', {
        treeDataProvider: findingsTreeProvider,
      });

      const findingWatcher = new FindingWatcher({
        onCreate: findingsIndex.addFindingsFile.bind(findingsIndex),
        onDelete: findingsIndex.removeFindingsFile.bind(findingsIndex),
        onChange: (uri) => {
          findingsIndex.removeFindingsFile(uri);
          findingsIndex.addFindingsFile(uri);
        },
      });
      workspaceServices.enroll(findingWatcher);
    }

    appmapCollectionFile.initialize();

    const { localTree } = registerTrees(context, appmapCollectionFile);

    (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder) => {
      Telemetry.sendEvent(PROJECT_OPEN, { rootDirectory: workspaceFolder.uri.fsPath });
    });

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
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, { exception: exception as Error });
    throw exception;
  }
}
