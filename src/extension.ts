import * as vscode from 'vscode';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import { Telemetry, DEBUG_EXCEPTION } from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './appmapCollectionFile';
import RemoteRecording from './remoteRecording';
import { notEmpty } from './util';
import { registerUtilityCommands } from './registerUtilityCommands';
import ProjectWatcher from './projectWatcher';
import QuickstartWebview from './quickstartWebview';
import QuickstartDocsInstallAgent from './quickstart-docs/installAgentWebview';
import QuickstartDocsOpenAppmaps from './quickstart-docs/openAppmapsWebview';
import AppMapProperties from './appmapProperties';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    const localAppMaps = new AppMapCollectionFile();

    Telemetry.register(context);

    const properties = new AppMapProperties(context);
    if (properties.isNewInstall) {
      Telemetry.reportAction('plugin:install');
    }

    ScenarioProvider.register(context, properties);
    DatabaseUpdater.register(context);
    RemoteRecording.register(context);

    localAppMaps.initialize();

    const appmapWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.appmap.json',
      false,
      true,
      true
    );
    context.subscriptions.push(appmapWatcher);

    const projects = (vscode.workspace.workspaceFolders || []).map((workspaceFolder) => {
      const project = new ProjectWatcher(context, workspaceFolder, appmapWatcher, properties);
      return project;
    });

    QuickstartWebview.register(context, projects, localAppMaps);

    await Promise.all(projects.map(async (project) => await project.initialize()));

    QuickstartDocsInstallAgent.register(context, properties, projects);
    QuickstartDocsOpenAppmaps.register(context, projects, localAppMaps);

    const { localTree } = registerTrees(context, localAppMaps, projects);

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

    registerUtilityCommands(context, properties);
  } catch (exception) {
    Telemetry.sendEvent(DEBUG_EXCEPTION, { exception });
    throw exception;
  }
}
