import * as vscode from 'vscode';
import AppMapCollection from '../services/appmapCollection';

const LABEL_NO_NAME = 'Untitled AppMap';
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
      .map((appmap) => ({
        label: (appmap.descriptor.metadata?.name as string) || LABEL_NO_NAME,
        tooltip: (appmap.descriptor.metadata?.name as string) || LABEL_NO_NAME,
        command: {
          title: 'open',
          command: 'vscode.openWith',
          arguments: [appmap.descriptor.resourceUri, 'appmap.views.appMapFile'],
        },
        contextValue: 'appmap.views.local.item',
        descriptor: appmap.descriptor,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return Promise.resolve(listItems);
  }
}
