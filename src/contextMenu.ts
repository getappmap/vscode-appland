import * as vscode from 'vscode';

interface TreeItemContext {
  descriptor: {
    resourceUri: vscode.Uri;
  };
}

export default class ContextMenu {
  static async register(context: vscode.ExtensionContext): Promise<void> {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openInFileExplorer',
        async (item: TreeItemContext) => {
          vscode.commands.executeCommand('revealFileInOS', item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openAsJson',
        async (item: TreeItemContext) => {
          vscode.commands.executeCommand('vscode.openWith', item.descriptor.resourceUri, 'default');
        }
      )
    );
  }
}
