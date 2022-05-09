import * as vscode from 'vscode';
import AppMapCollectionFile from '../appmapCollectionFile';
import { AppMapTreeDataProvider } from './AppMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import Links from './links';
import { GettingStartedTreeDataProvider } from './gettingStartedTreeDataProvider';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollectionFile
): Record<string, vscode.TreeView<vscode.TreeItem>> {
  const localTreeProvider = new AppMapTreeDataProvider(localAppMaps);
  const localTree = vscode.window.createTreeView('appmap.views.local', {
    treeDataProvider: localTreeProvider,
  });

  LinkTreeDataProvider.registerCommands(context);

  const documentationTreeProvider = new LinkTreeDataProvider(context, Links.Documentation);
  const documentation = vscode.window.createTreeView('appmap.views.documentation', {
    treeDataProvider: documentationTreeProvider,
  });

  const gettingStartedTreeProvider = new GettingStartedTreeDataProvider();
  const gettingStartedTree = vscode.window.createTreeView('appmap.views.milestones', {
    treeDataProvider: gettingStartedTreeProvider,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.focus', () => {
      localTree.reveal(localAppMaps.appMaps[0], { select: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.focusgettingStarted', (index = 0) => {
      setTimeout(() => {
        gettingStartedTree.reveal(gettingStartedTreeProvider.items[index]);
      }, 0);
    })
  );

  return { localTree, documentation };
}
