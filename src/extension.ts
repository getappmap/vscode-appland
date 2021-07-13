import * as vscode from 'vscode';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import Telemetry, { Events } from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './appmapCollectionFile';
import RemoteRecording from './remoteRecording';
import { notEmpty } from './util';
import ProjectWatcher from './projectWatcher';
import QuickstartWebview from './quickstartWebview';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    const localAppMaps = new AppMapCollectionFile();

    Telemetry.register(context);
    ScenarioProvider.register(context);
    DatabaseUpdater.register(context);
    RemoteRecording.register(context);

    localAppMaps.initialize();

    const projects = (vscode.workspace.workspaceFolders || []).map((workspaceFolder) => {
      const project = new ProjectWatcher(context, workspaceFolder);
      return project;
    });

    QuickstartWebview.register(context, projects);

    await Promise.all(projects.map(async (project) => await project.initialize()));

    const { localTree } = registerTrees(context, localAppMaps, projects);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.applyFilter', async () => {
        const filter = await vscode.window.showInputBox({
          placeHolder:
            'Enter a case sensitive partial match or leave this input empty to clear an existing filter',
        });

        localAppMaps.setFilter(filter || '');
        localTree.reveal(localAppMaps.appmapDescriptors[0], { select: false });
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.findByName', async () => {
        const items = localAppMaps
          .allDescriptors()
          .map((d) => d.metadata?.name as string)
          .filter(notEmpty)
          .sort();

        const name = await vscode.window.showQuickPick(items, {});
        if (!name) {
          return;
        }

        const descriptor = localAppMaps.findByName(name);
        if (!descriptor) {
          return;
        }

        vscode.commands.executeCommand('vscode.open', descriptor.resourceUri);
      })
    );
  } catch (exception) {
    Telemetry.sendEvent(Events.DEBUG_EXCEPTION, { exception });
    throw exception;
  }
}
