import * as vscode from 'vscode';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import { AppMapDescriptor } from '../services/appmapLoader';

const LABEL_NO_NAME = 'Untitled AppMap';

class AppMapTreeItem extends vscode.TreeItem {
  descriptor?: AppMapDescriptor;
}

export class AppMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmaps: AppMapCollection;

  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(appmaps: AppMapCollection) {
    this.appmaps = appmaps;
    this.appmaps.onUpdated(() => this._onDidChangeTreeData.fire(undefined));
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    if (!this.appmaps) {
      return Promise.resolve([]);
    }

    const listItems = this.appmaps
      .appMaps()
      .map(buildTreeItem)
      .sort((a, b) => (a.label || '').toString().localeCompare((b.label || '').toString()));

    return Promise.resolve(listItems);
  }
}

function buildTreeItem(appmap: AppMapLoader): AppMapTreeItem {
  return {
    label: (appmap.descriptor.metadata?.name as string) || LABEL_NO_NAME,
    tooltip: (appmap.descriptor.metadata?.name as string) || LABEL_NO_NAME,
    command: {
      title: 'open',
      command: 'vscode.openWith',
      arguments: [appmap.descriptor.resourceUri, 'appmap.views.appMapFile'],
    },
    contextValue: 'appmap.views.local.appMap',
    descriptor: appmap.descriptor,
  };
}
