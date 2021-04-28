import * as vscode from 'vscode';
import AppMapCollection from '../appmapCollection';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';

export default function registerTrees(localAppMaps: AppMapCollection): void {
  const localTree = new AppMapTreeDataProvider(localAppMaps);

  vscode.window.registerTreeDataProvider('appmap.views.local', localTree);
}
