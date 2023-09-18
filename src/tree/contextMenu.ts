import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { CodeObjectTreeItem } from './classMapTreeDataProvider';
import { FolderItem } from './appMapTreeDataProvider';
import deleteAppMap from '../lib/deleteAppMap';
import deleteFolderAppMaps from '../lib/deleteFolderAppMaps';
import closeEditorByUri from '../lib/closeEditorByUri';
import AppMapCollection from '../services/appmapCollection';
import saveAppMapToCollection from '../lib/saveAppMapToCollection';
import AppMapLoader from '../services/appmapLoader';

export default class ContextMenu {
  static async register(
    context: vscode.ExtensionContext,
    appmaps: AppMapCollection
  ): Promise<void> {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openInFileExplorer',
        async (item: AppMapLoader) => {
          const { remoteName } = vscode.env;
          const command = remoteName === 'wsl' ? 'remote-wsl.revealInExplorer' : 'revealFileInOS';
          vscode.commands.executeCommand(command, item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.openAsJson', async (item: AppMapLoader) => {
        vscode.commands.executeCommand('vscode.openWith', item.descriptor.resourceUri, 'default');
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.rename', async (item: AppMapLoader) => {
        const newName = await vscode.window.showInputBox({
          placeHolder: 'Enter AppMap name',
          value: item.descriptor.metadata?.name as string,
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
        'appmap.context.saveToCollection',
        async (item: AppMapLoader) => {
          saveAppMapToCollection(item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.deleteAppMap', async (item: AppMapLoader) => {
        await deleteAppMap(item.descriptor.resourceUri, appmaps);
        await closeEditorByUri(item.descriptor.resourceUri);
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.deleteAppMaps',
        async ({ name }: FolderItem) => {
          deleteFolderAppMaps(appmaps, name);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.compareSequenceDiagrams',
        async (item: AppMapLoader) => {
          vscode.commands.executeCommand(
            'appmap.compareSequenceDiagrams',
            item.descriptor.resourceUri
          );
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
