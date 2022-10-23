import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { CodeObjectTreeItem } from './classMapTreeDataProvider';

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
          const err = e as Error;
          vscode.window.showErrorMessage(
            `Error while changing AppMap name: ${err.name}: ${err.message}`
          );
        }
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.sequenceDiagram',
        async (item: TreeItemContext) => {
          vscode.commands.executeCommand('appmap.sequenceDiagram', item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.inspectCodeObject',
        async (item: CodeObjectTreeItem) => {
          vscode.commands.executeCommand('appmap.inspectCodeObject', item.codeObjectFqid);
        }
      )
    );
  }
}
