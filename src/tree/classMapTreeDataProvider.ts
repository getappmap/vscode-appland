import assert from 'assert';
import { basename, isAbsolute } from 'path';
import * as vscode from 'vscode';
import ClassMapIndex, { CodeObjectEntry } from '../services/classMapIndex';

export interface CodeObjectTreeItem extends vscode.TreeItem {
  codeObjectFqid: string;
  codeObjectType: string;
  codeObjectName: string;
}

export class ClassMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  classMap: ClassMapIndex;

  constructor(classMap: ClassMapIndex) {
    this.classMap = classMap;
    this.classMap.onChanged(() => this._onDidChangeTreeData.fire(undefined));
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

    return (await Promise.all((codeObjects || []).map(this.buildTreeItem.bind(this)))).sort(
      comparator
    );
  }

  private async buildTreeItem(codeObject: CodeObjectEntry): Promise<CodeObjectTreeItem> {
    const treeItem = {
      id: codeObject.fqid,
      codeObjectFqid: codeObject.fqid,
      codeObjectType: codeObject.type,
      codeObjectName: codeObject.name,
      label: codeObject.name,
      tooltip: codeObject.fqid,
      contextValue: `appmap.views.codeObjects.${codeObject.type}`,
      collapsibleState:
        codeObject.children.length > 0
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None,
    } as CodeObjectTreeItem;
    if (
      codeObject.type === 'function' &&
      codeObject.path &&
      codeObject.path.includes('.') // Filter out pseudo-filenames like 'OpenSSL'
    ) {
      const showOptions = {} as vscode.TextDocumentShowOptions;
      const fileAndLine = basename(codeObject.path);
      const [file, lineNumber] = fileAndLine.split(':');
      if (lineNumber) {
        showOptions.selection = new vscode.Range(
          new vscode.Position(parseInt(lineNumber) - 1, 0),
          new vscode.Position(parseInt(lineNumber) - 1, 0)
        );
      }
      let uri: vscode.Uri;
      if (isAbsolute(codeObject.path)) {
        uri = vscode.Uri.file(codeObject.path);
      } else {
        uri = vscode.Uri.joinPath(codeObject.folder.uri, codeObject.path);
      }
      treeItem.command = {
        command: 'vscode.open',
        title: `Open ${file}`,
        arguments: [uri, showOptions],
      };
    }
    return treeItem;
  }
}
