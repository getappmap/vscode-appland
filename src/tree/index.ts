import * as vscode from 'vscode';
import AppMapCollection from '../appmapCollection';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import Links from './links';
import { MilestoneTreeDataProvider } from './milestoneTreeDataProvider';
import ProjectWatcher from '../projectWatcher';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollection,
  projects: readonly ProjectWatcher[]
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

  const milestoneTreeProvider = new MilestoneTreeDataProvider(context, projects);
  const milestoneTree = vscode.window.createTreeView('appmap.views.milestones', {
    treeDataProvider: milestoneTreeProvider,
  });

  MilestoneTreeDataProvider.registerCommands(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.focus', () => {
      localTree.reveal(localAppMaps.appMaps[0], { select: false });
    })
  );

  return { localTree, documentation, milestoneTree };
}
