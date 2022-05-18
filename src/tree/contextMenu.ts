import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { CodeObjectTreeItem } from './classMapTreeDataProvider';
import { packageManagerCommand } from '../configuration/packageManager';
import { shellescape } from '../util';

interface TreeItemContext {
  descriptor: {
    resourceUri: vscode.Uri;
    metadata: Record<string, unknown>;
  };
}

// eslint-disable-next-line @typescript-eslint/naming-convention
let _appMapTerminal: vscode.Terminal | undefined;

function appMapTerminal(): vscode.Terminal {
  if (!_appMapTerminal) {
    _appMapTerminal = vscode.window.createTerminal('AppMap');
  }
  return _appMapTerminal;
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
        'appmap.context.inspectCodeObject',
        async (item: CodeObjectTreeItem) => {
          if (
            !vscode.workspace.workspaceFolders ||
            vscode.workspace.workspaceFolders.length === 0
          ) {
            return;
          }
          let workspace: vscode.WorkspaceFolder | undefined;
          if (vscode.workspace.workspaceFolders.length === 1) {
            workspace = vscode.workspace.workspaceFolders[0];
          } else {
            workspace = await vscode.window.showWorkspaceFolderPick();
          }
          if (!workspace) return;

          const searchArg = item.codeObjectFqid;
          const command = [
            ...(await packageManagerCommand(workspace.uri)),
            shellescape('appmap', 'inspect', '-i', searchArg),
          ].join(' ');
          appMapTerminal().show();
          appMapTerminal().sendText(command);
        }
      )
    );
  }
}
