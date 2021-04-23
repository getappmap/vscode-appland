import * as vscode from 'vscode';
import AppMapCollection from '../../appmapCollection';

const LABEL_NO_NAME = 'Untitled AppMap';
export class AppMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmaps: AppMapCollection;
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(appmaps: AppMapCollection) {
    this.appmaps = appmaps;
    this.appmaps.onUpdated(() => this._onDidChangeTreeData.fire());
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
      .appmapDescriptors()
      .map((d) => ({
        label: (d.metadata?.name as string) || LABEL_NO_NAME,
        tooltip: (d.metadata?.name as string) || LABEL_NO_NAME,
        command: {
          title: 'open',
          command: 'vscode.openWith',
          arguments: [d.resourceUri, 'appmap.views.appMapFile'],
        },
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return Promise.resolve(listItems);
  }
}
