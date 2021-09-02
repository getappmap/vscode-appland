import * as vscode from 'vscode';
import { promises as fs } from 'fs';

interface TreeItemContext {
  descriptor: {
    resourceUri: vscode.Uri;
    metadata: Record<string, unknown>;
  };
}

export default class ContextMenu {
  static async register(context: vscode.ExtensionContext): Promise<void> {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openInFileExplorer',
        async (item: TreeItemContext) => {
          const { remoteName } = vscode.env;
          const command = remoteName === 'wsl' ? 'remote-wsl.revealInExplorer' : 'revealFileInOS';
          vscode.commands.executeCommand(command, item.descriptor.resourceUri);
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
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.rename', async (item: TreeItemContext) => {
        const newName = await vscode.window.showInputBox({
          placeHolder: 'Enter AppMap name',
          value: item.descriptor.metadata.name as string,
        });

        if (!newName) {
          return;
        }

        try {
          const file = await fs.readFile(item.descriptor.resourceUri.fsPath);
          const content = JSON.parse(file.toString());

          content.metadata.name = newName;

          fs.writeFile(item.descriptor.resourceUri.fsPath, JSON.stringify(content));
        } catch (e) {
          vscode.window.showErrorMessage(
            `Error while changing AppMap name: ${e.name}: ${e.message}`
          );
        }
      })
    );
  }
}
