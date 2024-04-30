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
      vscode.commands.registerCommand('appmap.context.openAsJson', async (item?: AppMapLoader) => {
        let uri: vscode.Uri | null;
        if (!item) {
          uri = ContextMenu.getActiveAppMap();
          if (!uri) {
            return;
          }
        } else {
          uri = item.descriptor.resourceUri;
        }

        vscode.commands.executeCommand('vscode.openWith', uri, 'default');
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
      vscode.commands.registerCommand(
        'appmap.context.deleteAppMap',
        async (item?: AppMapLoader) => {
          let uri: vscode.Uri | null;
          if (!item) {
            uri = ContextMenu.getActiveAppMap();
            if (!uri) {
              return;
            }
          } else {
            uri = item.descriptor.resourceUri;
          }

          await deleteAppMap(uri, appmaps);
          await closeEditorByUri(uri);
        }
      )
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

  private static getActiveAppMap(): vscode.Uri | null {
    const { activeTab } = vscode.window.tabGroups.activeTabGroup;
    if (!activeTab) {
      vscode.window.showErrorMessage('No active editor.');
      return null;
    }

    const input = activeTab.input;
    if (input instanceof vscode.TabInputCustom && input.viewType === 'appmap.views.appMapFile')
      return input.uri;
    else {
      vscode.window.showErrorMessage('No AppMap open in the active tab.');
      return null;
    }
  }
}
