import * as vscode from 'vscode';
import AppMapCollectionFile from '../appmapCollectionFile';
import Links from './links';
import { InstructionsTreeDataProvider } from './instructionsTreeDataProvider';
import { AppMapTreeDataProvider } from './AppMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollectionFile
): Record<string, vscode.TreeView<vscode.TreeItem>> {
  LinkTreeDataProvider.registerCommands(context);

  const instructionsTreeProvider = new InstructionsTreeDataProvider();
  const instructionsTree = vscode.window.createTreeView('appmap.views.instructions', {
    treeDataProvider: instructionsTreeProvider,
  });

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

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.focusInstructions', (index = 0) => {
      setTimeout(() => {
        // TODO: (KEG) Here is where we would show the repo state to determine which step should be
        // shown by default.
        instructionsTree.reveal(instructionsTreeProvider.items[index]);
      }, 0);
    })
  );

  return { instructionsTree, localTree: localAppMapsTree, documentation };
}
