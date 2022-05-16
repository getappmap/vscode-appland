import assert from 'assert';
import * as vscode from 'vscode';
import ClassMapIndex, { CodeObjectEntry } from '../services/classMapIndex';

export class ClassMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  classMap: ClassMapIndex;

  constructor(classMap: ClassMapIndex) {
    this.classMap = classMap;
    this.classMap.onChanged(() => this._onDidChangeTreeData.fire());
  }

  async getTreeItem(element: vscode.TreeItem): Promise<vscode.TreeItem> {
    assert(element.id);
    const codeObject = await this.classMap.lookupCodeObject(element.id);
    assert(codeObject);

    return this.buildTreeItem(codeObject);
  }

  async getParent(element?: vscode.TreeItem): Promise<vscode.TreeItem | null> {
    if (!element) return Promise.resolve(null);

    assert(element.id);
    const codeObject = await this.classMap.lookupCodeObject(element.id);
    if (!codeObject) return Promise.resolve(null);
    if (!codeObject.parent) return Promise.resolve(null);

    return this.buildTreeItem(codeObject.parent);
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    let codeObjects: CodeObjectEntry[] = [];
    if (element) {
      assert(element.id);
      const codeObject = await this.classMap.lookupCodeObject(element.id);
      if (codeObject) codeObjects = codeObject.children;
    } else {
      codeObjects = await this.classMap.classMap();
    }

    const comparator = (a: vscode.TreeItem, b: vscode.TreeItem): number => {
      assert(a.label);
      assert(b.label);
      const aLabel = a.label.toString();
      const bLabel = b.label.toString();
      const aTokens = aLabel.split(' ');
      const bTokens = bLabel.split(' ');

      if (
        aTokens.length >= 2 &&
        bTokens.length >= 2 &&
        aTokens[1].charAt(0) === '/' &&
        bTokens[1].charAt(0) === '/'
      ) {
        // Sort routes by path first, then method.
        let diff = aTokens[1].localeCompare(bTokens[1]);
        if (diff === 0) diff = aTokens[0].localeCompare(bTokens[0]);
        return diff;
      }
      return aLabel.localeCompare(bLabel);
    };

    return (codeObjects || []).map(this.buildTreeItem.bind(this)).sort(comparator);
  }

  private buildTreeItem(codeObject: CodeObjectEntry): vscode.TreeItem {
    return {
      id: codeObject.fqid,
      label: codeObject.name,
      tooltip: codeObject.fqid,
      collapsibleState:
        codeObject.children.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    };
  }
}
