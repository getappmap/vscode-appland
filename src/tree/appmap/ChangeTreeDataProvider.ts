import * as vscode from 'vscode';
import AppMapDescriptor from '../../appmapDescriptor';

export class ChangeTreeDataProvider
  implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmapDescriptors: Promise<AppMapDescriptor[]> | null;

  constructor(appmapDescriptors: Promise<AppMapDescriptor[]> | null) {
    this.appmapDescriptors = appmapDescriptors;
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    if (!this.appmapDescriptors) {
      return Promise.resolve([]);
    }

    return this.appmapDescriptors.then((descriptors) => {
      const listItems = descriptors
        .map((d) => ({
          label: d.metadata?.name as string,
          tooltip: d.metadata?.name as string,
          command: {
            title: 'open',
            command: 'vscode.open',
            arguments: [d.resourceUri],
          },
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return Promise.resolve(listItems);
    });
  }
}
