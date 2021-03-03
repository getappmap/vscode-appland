import * as vscode from 'vscode';
import AppMapDescriptorFile from '../appmapDescriptorFile';
import AppMapDescriptorRemote from '../appmapDescriptorRemote';
import { AppMapTreeDataProvider } from './appmap/AppMapTreeDataProvider';
import { ChangeTreeDataProvider } from './appmap/ChangeTreeDataProvider';

export default function registerTrees(
  localAppMaps: Promise<AppMapDescriptorFile[]>,
  remoteAppMaps: Promise<AppMapDescriptorRemote[]>
): void {
  vscode.window.registerTreeDataProvider(
    'appmap.views.local',
    new AppMapTreeDataProvider(localAppMaps)
  );

  vscode.window.registerTreeDataProvider(
    'appmap.views.remote',
    new AppMapTreeDataProvider(remoteAppMaps)
  );

  vscode.window.registerTreeDataProvider(
    'appmap.views.changes',
    new ChangeTreeDataProvider(remoteAppMaps, localAppMaps)
  );
}
