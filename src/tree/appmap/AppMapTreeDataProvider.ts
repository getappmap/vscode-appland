import * as vscode from 'vscode';
import AppMapDescriptor from '../../appmapDescriptor';

const LABEL_NO_NAME = 'Untitled AppMap';
export class AppMapTreeDataProvider
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
          label: (d.metadata?.name as string) || LABEL_NO_NAME,
          tooltip: (d.metadata?.name as string) || LABEL_NO_NAME,
          command: {
            title: 'open',
            command: 'vscode.openWith',
            arguments: [d.resourceUri, 'appmap.appMapFile'],
          },
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return Promise.resolve(listItems);
    });
  }
}
