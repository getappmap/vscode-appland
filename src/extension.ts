import * as vscode from 'vscode';
import AppLandClient from './applandClient';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import registerDiff from './diffViewer';
import registerTrees from './tree';
import AppLandRemoteTextDocumentProvider from './applandRemoteTextDocumentContentProvider';
import AppMapCollectionFile from './appmapCollectionFile';
import AppMapCollectionRemote from './appmapCollectionRemote';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const api = await AppLandClient.fromEnvironment();
  const localAppMaps = new AppMapCollectionFile();
  const remoteAppMaps = new AppMapCollectionRemote(api);

  // localAppMaps.onContentChanged((descriptor) => {
  //   if (!descriptor.metadata) {
  //     return;
  //   }

  //   if (!descriptor.metadata.fingerprints) {

  //   }
  // })

  vscode.workspace.registerTextDocumentContentProvider('appmap', new AppLandRemoteTextDocumentProvider(api));
  localAppMaps.initialize();
  remoteAppMaps.initialize();
  ScenarioProvider.register(context);
  DatabaseUpdater.register(context);
  registerDiff(context);
  registerTrees(localAppMaps, remoteAppMaps);
}
