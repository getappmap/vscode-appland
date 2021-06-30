import * as vscode from 'vscode';
import * as path from 'path';
import svgComplete from '../../web/static/media/tree/complete.svg';
import svgLink from '../../web/static/media/tree/link.svg';

interface LinkDefinitions {
  [key: string]: {
    label: string;
    link: string;
    visited?: boolean;
  };
}

export class LinkTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly context: vscode.ExtensionContext;
  private readonly linkDefinitions: LinkDefinitions;
  private _onDidChangeTreeData: vscode.EventEmitter<
    vscode.TreeItem | undefined | null | void
  > = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  public readonly onDidChangeTreeData: vscode.Event<
    vscode.TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  constructor(context: vscode.ExtensionContext, linkDefinitions: LinkDefinitions) {
    this.context = context;
    this.linkDefinitions = { ...linkDefinitions };

    const visitedLinks = (context.globalState.get('VISITED_LINKS') || []) as Array<string>;
    visitedLinks.forEach((linkId) => {
      const linkDefinition = this.linkDefinitions[linkId];
      if (linkDefinition) {
        linkDefinition.visited = true;
      }
    });
  }

  static registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.openLink',
        async (url: vscode.Uri, linkId: string, updateCallback: () => void) => {
          vscode.env.openExternal(url);

          const visitedLinks = (context.globalState.get('VISITED_LINKS') || []) as Array<string>;
          if (!visitedLinks.includes(linkId)) {
            visitedLinks.push(linkId);
            context.globalState.update('VISITED_LINKS', visitedLinks);
          }

          updateCallback();
        }
      )
    );
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    const visitedLinks = (this.context.globalState.get('VISITED_LINKS') || []) as Array<string>;

    const items = Object.entries(this.linkDefinitions).map(([id, item]) => {
      const treeItem = new vscode.TreeItem(item.label);
      treeItem.id = id as string;
      treeItem.command = {
        command: 'appmap.openLink',
        arguments: [
          vscode.Uri.parse(item.link),
          id,
          () => {
            this.onUpdate();
          },
        ],
      } as vscode.Command;

      const iconPath = visitedLinks.includes(id) ? svgComplete : svgLink;
      treeItem.iconPath = path.join(__dirname, iconPath);

      return treeItem;
    });

    return Promise.resolve(items);
  }

  private onUpdate() {
    this._onDidChangeTreeData.fire();
  }
}
