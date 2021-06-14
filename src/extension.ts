import * as vscode from 'vscode';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import Telemetry from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './appmapCollectionFile';
import RemoteRecording from './remoteRecording';
import { notEmpty } from './util';
import { getFileProperties } from './telemetry/properties/file';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const localAppMaps = new AppMapCollectionFile();

  Telemetry.register(context);
  ScenarioProvider.register(context);
  DatabaseUpdater.register(context);
  RemoteRecording.register(context);

  localAppMaps.initialize();
  const { localTree } = registerTrees(localAppMaps);

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

  Telemetry.reportStartUp();

  // TODO: remove temporary global function
  global['getFileProperties'] = getFileProperties;
}
