import * as vscode from 'vscode';
import AppMapCollection from '../appmapCollection';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';
import { ChangeTreeDataProvider } from './appmap/ChangeTreeDataProvider';

export default function registerTrees(localAppMaps: AppMapCollection, remoteAppMaps: AppMapCollection): void {
  const localTree = new AppMapTreeDataProvider(localAppMaps);
  const remoteTree = new AppMapTreeDataProvider(remoteAppMaps);
  const changeTree = new ChangeTreeDataProvider(remoteAppMaps, localAppMaps);

  vscode.window.registerTreeDataProvider('appmap.views.local', localTree);
  vscode.window.registerTreeDataProvider('appmap.views.remote', remoteTree);
  vscode.window.registerTreeDataProvider('appmap.views.changes', changeTree);
}
