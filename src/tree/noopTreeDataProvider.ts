import { TreeDataProvider, TreeItem } from 'vscode';

// For use in an uninitialized tree or a tree which will never populate (e.g., a welcome view)
export class NoopTreeDataProvider implements TreeDataProvider<TreeItem> {
  public getTreeItem(element: TreeItem): TreeItem {
    return element;
  }

  public getChildren(): Thenable<TreeItem[]> {
    return Promise.resolve([]);
  }
}
