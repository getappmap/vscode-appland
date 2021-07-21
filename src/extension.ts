import * as vscode from 'vscode';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import Telemetry, { Events } from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './appmapCollectionFile';
import RemoteRecording from './remoteRecording';
import { getQuickstartSeen, notEmpty, setQuickstartSeen } from './util';
import { registerUtilityCommands } from './registerUtilityCommands';
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

    const appmapWatcher = vscode.workspace.createFileSystemWatcher(
      '**/*.appmap.json',
      false,
      true,
      true
    );
    context.subscriptions.push(appmapWatcher);

    const projects = (vscode.workspace.workspaceFolders || []).map((workspaceFolder) => {
      const project = new ProjectWatcher(context, workspaceFolder, appmapWatcher);
      return project;
    });

    QuickstartWebview.register(context, projects, localAppMaps);

    await Promise.all(projects.map(async (project) => await project.initialize()));

    const { localTree, milestoneTree } = registerTrees(context, localAppMaps, projects);

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

    registerUtilityCommands(context);

    if (!getQuickstartSeen(context) && projects.length == 1) {
      // only open the quickstart for the first time and a single-project workspace is open
      // open the quickstart WebView, step INSTALL_AGENT
      const installAgentMilestone = projects[0].milestones['INSTALL_AGENT'];
      vscode.commands.executeCommand('appmap.clickMilestone', installAgentMilestone);
      // open the quickstart side view
      milestoneTree.reveal(installAgentMilestone, { focus: false });
      setQuickstartSeen(context, true);
    }
  } catch (exception) {
    Telemetry.sendEvent(Events.DEBUG_EXCEPTION, { exception });
    throw exception;
  }
}
