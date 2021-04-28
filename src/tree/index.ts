import * as vscode from 'vscode';
import AppMapCollection from '../appmapCollection';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';

export default function registerTrees(
  localAppMaps: AppMapCollection
): Record<string, vscode.TreeView<vscode.TreeItem>> {
  const localTreeProvider = new AppMapTreeDataProvider(localAppMaps);
  const localTree = vscode.window.createTreeView('appmap.views.local', {
    treeDataProvider: localTreeProvider,
  });

  return { localTree };
}
