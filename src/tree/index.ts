import * as vscode from 'vscode';
import AppMapCollection from '../appmapCollection';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import Links from './links';
import { QuickStartTreeDataProvider } from './quickstart/quickstartTreeDataProvider';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollection
): Record<string, vscode.TreeView<vscode.TreeItem>> {
  const localTreeProvider = new AppMapTreeDataProvider(localAppMaps);
  const localTree = vscode.window.createTreeView('appmap.views.local', {
    treeDataProvider: localTreeProvider,
  });

  LinkTreeDataProvider.registerCommands(context);

  const quickstartTreeProvider = new QuickStartTreeDataProvider(context);
  const quickstart = vscode.window.createTreeView('appmap.views.quickstart', {
    treeDataProvider: quickstartTreeProvider,
  });

  quickstartTreeProvider.setState('INSTALL_EXTENSION', 'complete');

  const usingAppmapsTreeProvider = new LinkTreeDataProvider(context, Links.UsingAppMaps);
  const usingAppmaps = vscode.window.createTreeView('appmap.views.usingAppmaps', {
    treeDataProvider: usingAppmapsTreeProvider,
  });

  const masteringAppmapsTreeProvider = new LinkTreeDataProvider(context, Links.MasteringAppMaps);
  const masteringAppmaps = vscode.window.createTreeView('appmap.views.masteringAppmaps', {
    treeDataProvider: masteringAppmapsTreeProvider,
  });

  return { localTree, quickstart, usingAppmaps, masteringAppmaps };
}
