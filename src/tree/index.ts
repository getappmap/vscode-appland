import * as vscode from 'vscode';
import AppMapCollectionFile from '../services/appmapCollectionFile';
import Links from './links';
import { DocsPages, InstructionsTreeDataProvider } from './instructionsTreeDataProvider';
import { AppMapTreeDataProvider } from './appMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { AppmapUptodateService } from '../services/appmapUptodateService';
import { AppMapTreeDataProviders } from '../appMapService';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollectionFile,
  projectStates: ProjectStateServiceInstance[],
  appmapsUptodate?: AppmapUptodateService
): AppMapTreeDataProviders {
  LinkTreeDataProvider.registerCommands(context);

  const instructionsTreeProvider = new InstructionsTreeDataProvider(context, projectStates);
  const instructionsTree = vscode.window.createTreeView('appmap.views.instructions', {
    treeDataProvider: instructionsTreeProvider,
  });

  const localAppMapsProvider = new AppMapTreeDataProvider(localAppMaps, appmapsUptodate);
  const localAppMapsTree = vscode.window.createTreeView('appmap.views.local', {
    treeDataProvider: localAppMapsProvider,
  });
  context.subscriptions.push(localAppMapsTree);

  const documentationTreeProvider = new LinkTreeDataProvider(context, Links.Documentation);
  const documentationTree = vscode.window.createTreeView('appmap.views.documentation', {
    treeDataProvider: documentationTreeProvider,
  });
  context.subscriptions.push(documentationTree);

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.view.focusAppMap', () => {
      localAppMapsTree.reveal(localAppMaps.appMaps[0], { select: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.view.focusInstructions', (index = 0) => {
      setTimeout(() => {
        // TODO: (KEG) Here is where we would show the repo state to determine which step should be
        // shown by default.
        instructionsTree.reveal(DocsPages[index]);
      }, 0);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.applyFilter', async () => {
      const filter = await vscode.window.showInputBox({
        placeHolder:
          'Enter a case sensitive partial match or leave this input empty to clear an existing filter',
      });

      localAppMaps.setFilter(filter || '');
      localAppMapsTree.reveal(localAppMaps.appMaps[0], { select: false });
    })
  );

  return { appmaps: localAppMapsProvider };
}
