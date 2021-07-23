import * as vscode from 'vscode';

const docsPages = [
  {
    id: 'QUICKSTART_DOCS_INSTALL_AGENT',
    title: 'Install AppMap Agent',
    command: 'appmap.openQuickstartDocsInstallAgent',
  },
  {
    id: 'QUICKSTART_DOCS_OPEN_APPMAPS',
    title: 'Open AppMaps',
    command: 'appmap.openQuickstartDocsOpenAppmaps',
  },
];

export class QuickstartDocsTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    const items = docsPages.map((page) => {
      const treeItem = new vscode.TreeItem(page.title);
      treeItem.id = page.id as string;
      treeItem.command = {
        command: page.command,
      } as vscode.Command;

      return treeItem;
    });

    return Promise.resolve(items);
  }
}
