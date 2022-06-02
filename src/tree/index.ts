import * as vscode from 'vscode';
import AppMapCollectionFile from '../services/appmapCollectionFile';
import Links from './links';
import { InstructionsTreeDataProvider } from './instructionsTreeDataProvider';
import { AppMapTreeDataProvider } from './appMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import { ProjectStateServiceInstance } from '../services/projectStateService';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollectionFile,
  projectStates: ProjectStateServiceInstance[]
): Record<string, vscode.TreeView<vscode.TreeItem>> {
  LinkTreeDataProvider.registerCommands(context);

  const instructionsTreeProvider = new InstructionsTreeDataProvider(context, projectStates);
  const instructionsTree = vscode.window.createTreeView('appmap.views.instructions', {
    treeDataProvider: instructionsTreeProvider,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.focusInstructions', (index = 0) => {
      setTimeout(() => {
        // TODO: (KEG) Here is where we would show the repo state to determine which step should be
        // shown by default.
        instructionsTree.reveal(instructionsTreeProvider.items[index]);
      }, 0);
    })
  );

  const localAppMapsProvider = new AppMapTreeDataProvider(localAppMaps);
  const localAppMapsTree = vscode.window.createTreeView('appmap.views.local', {
    treeDataProvider: localAppMapsProvider,
  });

  const documentationTreeProvider = new LinkTreeDataProvider(context, Links.Documentation);
  const documentation = vscode.window.createTreeView('appmap.views.documentation', {
    treeDataProvider: documentationTreeProvider,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.focus', () => {
      localAppMapsTree.reveal(localAppMaps.appMaps[0], { select: false });
    })
  );

  return { localTree: localAppMapsTree, documentation };
}
