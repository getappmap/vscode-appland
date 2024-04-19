import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { CodeObjectTreeItem } from './classMapTreeDataProvider';
import { IAppMapTreeItem } from './appMapTreeDataProvider';
import deleteAppMap from '../lib/deleteAppMap';
import deleteFolderAppMaps from '../lib/deleteFolderAppMaps';
import closeEditorByUri from '../lib/closeEditorByUri';
import AppMapCollection from '../services/appmapCollection';
import saveAppMapToCollection from '../lib/saveAppMapToCollection';
import assert from 'assert';

export default class ContextMenu {
  static async register(
    context: vscode.ExtensionContext,
    appmaps: AppMapCollection
  ): Promise<void> {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openInFileExplorer',
        async (item: IAppMapTreeItem) => {
          assert(item.appmap);
          const { descriptor } = item.appmap;

          const { remoteName } = vscode.env;
          const command = remoteName === 'wsl' ? 'remote-wsl.revealInExplorer' : 'revealFileInOS';
          vscode.commands.executeCommand(command, descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openAsJson',
        async (item: IAppMapTreeItem) => {
          vscode.commands.executeCommand(
            'vscode.openWith',
            item.appmap?.descriptor.resourceUri,
            'default'
          );
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.rename', async (item: IAppMapTreeItem) => {
        assert(item.appmap);
        const { descriptor } = item.appmap;

        const newName = await vscode.window.showInputBox({
          placeHolder: 'Enter AppMap name',
          value: descriptor.metadata?.name as string,
        });

        if (!newName) {
          return;
        }

        try {
          const file = await fs.readFile(descriptor.resourceUri.fsPath);
          const content = JSON.parse(file.toString());

          content.metadata.name = newName;

          fs.writeFile(descriptor.resourceUri.fsPath, JSON.stringify(content));
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
        async (item: IAppMapTreeItem) => {
          assert(item.appmap);
          const { descriptor } = item.appmap;

          saveAppMapToCollection(descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.deleteAppMap',
        async (item: IAppMapTreeItem) => {
          let uri: vscode.Uri;
          if (!item) {
            const { activeTab } = vscode.window.tabGroups.activeTabGroup;
            if (!activeTab) {
              vscode.window.showErrorMessage('No active editor.');
              return;
            }

            uri = (activeTab.input as vscode.TabInputCustom).uri;
          } else {
            assert(item.appmap);
            const { descriptor } = item.appmap;
            uri = descriptor.resourceUri;
          }

          await deleteAppMap(uri, appmaps);
          await closeEditorByUri(uri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.deleteAppMaps',
        async (treeItem: IAppMapTreeItem) => {
          deleteFolderAppMaps(appmaps, treeItem);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.compareSequenceDiagrams',
        async (item: IAppMapTreeItem) => {
          assert(item.appmap);
          const { descriptor } = item.appmap;

          vscode.commands.executeCommand('appmap.compareSequenceDiagrams', descriptor.resourceUri);
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
