import * as vscode from 'vscode';
import * as path from 'path';
import quickstartItems from './items';

import svgIncomplete from '../../../web/static/media/tree/incomplete.svg';
import svgComplete from '../../../web/static/media/tree/complete.svg';
import svgError from '../../../web/static/media/tree/error.svg';

const ICONS = {
  incomplete: svgIncomplete,
  complete: svgComplete,
  error: svgError,
};

type QuickStartState = 'incomplete' | 'complete' | 'error';

interface QuickStartStates {
  [key: string]: QuickStartState;
}

class QuickStartTreeItem extends vscode.TreeItem {
  constructor(
    public readonly id: string,
    private readonly itemState?: QuickStartState,
    public readonly collapsibleState?: vscode.TreeItemCollapsibleState
  ) {
    super(quickstartItems[id].label, collapsibleState);

    this.iconPath = QuickStartTreeItem.getIconPath(this.itemState || 'incomplete');
  }

  private static getIconPath(state: QuickStartState): string {
    return path.join(__dirname, ICONS[state]);
  }
}

export class QuickStartTreeDataProvider implements vscode.TreeDataProvider<QuickStartTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    QuickStartTreeItem | undefined | null | void
  > = new vscode.EventEmitter<QuickStartTreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    QuickStartTreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  public getTreeItem(element: QuickStartTreeItem): QuickStartTreeItem {
    return element;
  }

  public getChildren(): Thenable<QuickStartTreeItem[]> {
    const itemStates = (this.context.workspaceState.get('QUICKSTART_STATES') ||
      []) as QuickStartStates;

    const items = Object.entries(quickstartItems).map(([id]) => {
      return new QuickStartTreeItem(id, itemStates[id]);
    });

    return Promise.resolve(items);
  }

  public setState(id: string, state: QuickStartState) {
    if (quickstartItems[id] === undefined) throw new Error('Undefined quickstart id');

    const itemStates = (this.context.workspaceState.get('QUICKSTART_STATES') ||
      []) as QuickStartStates;

    itemStates[id] = state;

    // using fromEntries to get proper stringifyable object instead of empty array
    this.context.workspaceState.update(
      'QUICKSTART_STATES',
      Object.fromEntries(Object.entries(itemStates))
    );
    this.onUpdate();
  }

  private onUpdate() {
    this._onDidChangeTreeData.fire();
  }
}
