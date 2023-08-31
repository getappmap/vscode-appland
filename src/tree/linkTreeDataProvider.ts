import * as vscode from 'vscode';
import * as path from 'path';
import svgLink from '../../web/static/media/tree/link.svg';
import svgLinkVisited from '../../web/static/media/tree/link-visited.svg';

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

  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private static readonly VISITED_LINKS = 'VISITED_LINKS';

  constructor(context: vscode.ExtensionContext, linkDefinitions: LinkDefinitions) {
    this.context = context;
    this.linkDefinitions = { ...linkDefinitions };

    const visitedLinks = (context.globalState.get(LinkTreeDataProvider.VISITED_LINKS) ||
      []) as Array<string>;
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

          const visitedLinks = (context.globalState.get(LinkTreeDataProvider.VISITED_LINKS) ||
            []) as Array<string>;
          if (!visitedLinks.includes(linkId)) {
            visitedLinks.push(linkId);
            context.globalState.update(LinkTreeDataProvider.VISITED_LINKS, visitedLinks);
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
    const visitedLinks = (this.context.globalState.get(LinkTreeDataProvider.VISITED_LINKS) ||
      []) as Array<string>;

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

      const iconPath = visitedLinks.includes(id) ? svgLinkVisited : svgLink;
      treeItem.iconPath = path.join(__dirname, iconPath);

      return treeItem;
    });

    return Promise.resolve(items);
  }

  private onUpdate() {
    this._onDidChangeTreeData.fire(undefined);
  }

  public static resetState(context: vscode.ExtensionContext): void {
    context.globalState.update(LinkTreeDataProvider.VISITED_LINKS, null);
  }
}
