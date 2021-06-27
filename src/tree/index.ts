import * as vscode from 'vscode';
import AppMapCollection from '../appmapCollection';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import Links from './links';

export default function registerTrees(
  context: vscode.ExtensionContext,
  localAppMaps: AppMapCollection
): Record<string, vscode.TreeView<vscode.TreeItem>> {
  const localTreeProvider = new AppMapTreeDataProvider(localAppMaps);
  const localTree = vscode.window.createTreeView('appmap.views.local', {
    treeDataProvider: localTreeProvider,
  });

  LinkTreeDataProvider.registerCommands(context);

  const usingAppmapsTreeProvider = new LinkTreeDataProvider(context, Links.UsingAppMaps);
  const usingAppmaps = vscode.window.createTreeView('appmap.views.usingAppmaps', {
    treeDataProvider: usingAppmapsTreeProvider,
  });

  const masteringAppmapsTreeProvider = new LinkTreeDataProvider(context, Links.MasteringAppMaps);
  const masteringAppmaps = vscode.window.createTreeView('appmap.views.masteringAppmaps', {
    treeDataProvider: masteringAppmapsTreeProvider,
  });

  return { localTree, usingAppmaps, masteringAppmaps };
}
