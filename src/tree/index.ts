import * as vscode from 'vscode';
import AppMapCollectionFile from '../services/appmapCollectionFile';
import Links from './links';
import { AppMapTreeDataProvider } from './appMapTreeDataProvider';
import { LinkTreeDataProvider } from './linkTreeDataProvider';
import { AppmapUptodateService } from '../services/appmapUptodateService';
import { AppMapTreeDataProviders } from '../appMapService';
import { FindingsTreeDataProvider } from './findingsTreeDataProvider';
import { ClassMapTreeDataProvider } from './classMapTreeDataProvider';
import ClassMapIndex from '../services/classMapIndex';

export default function registerTrees(
  context: vscode.ExtensionContext,
  appmapCollection: AppMapCollectionFile,
  classMapIndex: ClassMapIndex,
  appmapsUptodate?: AppmapUptodateService
): AppMapTreeDataProviders {
  LinkTreeDataProvider.registerCommands(context);

  const localAppMapsProvider = new AppMapTreeDataProvider(appmapCollection, appmapsUptodate);
  const localAppMapsTree = vscode.window.createTreeView('appmap.views.appmaps', {
    treeDataProvider: localAppMapsProvider,
  });
  context.subscriptions.push(localAppMapsTree);

  const documentationTreeProvider = new LinkTreeDataProvider(context, Links.Documentation);
  const documentationTree = vscode.window.createTreeView('appmap.views.documentation', {
    treeDataProvider: documentationTreeProvider,
  });
  context.subscriptions.push(documentationTree);

  const findingsTreeProvider = new FindingsTreeDataProvider(context, appmapCollection);
  vscode.window.createTreeView('appmap.views.findings', {
    treeDataProvider: findingsTreeProvider,
  });
  context.subscriptions.push(findingsTreeProvider);

  const classMapProvider = new ClassMapTreeDataProvider(classMapIndex);
  const codeObjectsTree = vscode.window.createTreeView('appmap.views.codeObjects', {
    treeDataProvider: classMapProvider,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.view.focusCodeObjects', () => {
      codeObjectsTree.reveal(undefined, { expand: true, focus: true, select: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.view.focusAppMaps', () => {
      localAppMapsTree.reveal(localAppMapsProvider.getChildren()[0], {
        expand: true,
        focus: true,
        select: true,
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.view.focusAppMap', () => {
      localAppMapsTree.reveal(appmapCollection.appMaps[0], { select: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.applyFilter', async () => {
      const filter = await vscode.window.showInputBox({
        placeHolder:
          'Enter a case sensitive partial match or leave this input empty to clear an existing filter',
      });

      appmapCollection.setFilter(filter || '');
      localAppMapsTree.reveal(appmapCollection.appMaps[0], { select: false });
    })
  );

  return {
    appmaps: localAppMapsProvider,
    analysis: findingsTreeProvider,
    codeObjects: classMapProvider,
  };
}
