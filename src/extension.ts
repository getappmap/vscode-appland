import * as vscode from 'vscode';

import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import { Telemetry, DEBUG_EXCEPTION, TELEMETRY_ENABLED, PROJECT_OPEN } from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './appmapCollectionFile';
import ContextMenu from './contextMenu';
import RemoteRecording from './remoteRecording';
import { notEmpty } from './util';
import { registerUtilityCommands } from './registerUtilityCommands';
import OpenAppMapsWebview from './webviews/openAppmapsWebview';
import ExtensionState from './extensionState';
import projectPickerWebview from './webviews/projectPickerWebview';
import FindingsIndex from './findingsIndex';
import AutoIndexer from './services/autoIndexer';
import AutoScanner from './services/autoScanner';
import FindingsDiagnosticsProvider from './findingsDiagnosticsProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    const localAppMaps = new AppMapCollectionFile(context);
    const findingsIndex = new FindingsIndex(context);

    await Promise.all(
      (vscode.workspace.workspaceFolders || []).map(async (folder) => {
        const autoIndexer = new AutoIndexer(folder.uri.fsPath);
        const autoScanner = new AutoScanner(folder.uri.fsPath);
        await autoIndexer.start();
        await autoScanner.start();

        // TODO: Dynamically add and remove these in response to workspace (folder) changes.
        context.subscriptions.push(autoIndexer);
        context.subscriptions.push(autoScanner);
      })
    );

    Telemetry.register(context);

    const properties = new ExtensionState(context);
    if (properties.isNewInstall) {
      Telemetry.reportAction('plugin:install');
    }

    ScenarioProvider.register(context, properties);
    DatabaseUpdater.register(context);
    RemoteRecording.register(context);
    ContextMenu.register(context);

    projectPickerWebview(context, properties);

    (vscode.workspace.workspaceFolders || []).forEach((workspaceFolder) => {
      Telemetry.sendEvent(PROJECT_OPEN, { rootDirectory: workspaceFolder.uri.fsPath });
    });

    OpenAppMapsWebview.register(context, localAppMaps);

    const findingsDiagnosticsProvider = new FindingsDiagnosticsProvider();
    findingsIndex.onChanged((uri: vscode.Uri) => {
      findingsDiagnosticsProvider.updateFindings(uri, findingsIndex.findingsForUri(uri));
    });

    localAppMaps.initialize();
    findingsIndex.initialize();

    const { localTree } = registerTrees(context, localAppMaps, findingsIndex);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.applyFilter', async () => {
        const filter = await vscode.window.showInputBox({
          placeHolder:
            'Enter a case sensitive partial match or leave this input empty to clear an existing filter',
        });

        localAppMaps.setFilter(filter || '');
        localTree.reveal(localAppMaps.appMaps[0], { select: false });
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.findByName', async () => {
        const items = localAppMaps
          .allAppMaps()
          .map((loader) => loader.descriptor.metadata?.name as string)
          .filter(notEmpty)
          .sort();

        const name = await vscode.window.showQuickPick(items, {});
        if (!name) {
          return;
        }

        const loader = localAppMaps.findByName(name);
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
              context.globalState.update(ScenarioProvider.INITIAL_STATE, queryParams.get('state'));
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
