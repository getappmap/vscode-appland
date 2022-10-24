import * as vscode from 'vscode';
import { promises as fs } from 'fs';
import { CodeObjectTreeItem } from './classMapTreeDataProvider';
import { AppMapTreeDataProvider, AppMapTreeItem, RootTreeItem } from './appMapTreeDataProvider';
import deleteAppMap from '../lib/deleteAppMap';
import deleteFolderAppMaps from '../lib/deleteFolderAppMaps';
import AppMapCollection from '../services/appmapCollection';
import saveAppMapToCollection from '../lib/saveAppMapToCollection';
import { ProjectStateServiceInstance } from '../services/projectStateService';

export default class ContextMenu {
  static async register(
    context: vscode.ExtensionContext,
    projectStates: ReadonlyArray<ProjectStateServiceInstance>,
    appmaps: AppMapCollection
  ): Promise<void> {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.openInFileExplorer',
        async (item: AppMapTreeItem) => {
          const { remoteName } = vscode.env;
          const command = remoteName === 'wsl' ? 'remote-wsl.revealInExplorer' : 'revealFileInOS';
          vscode.commands.executeCommand(command, item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.openAsJson', async (item: AppMapTreeItem) => {
        vscode.commands.executeCommand('vscode.openWith', item.descriptor.resourceUri, 'default');
      })
    );
    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.context.rename', async (item: AppMapTreeItem) => {
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
        async (item: AppMapTreeItem) => {
          saveAppMapToCollection(projectStates, item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.sequenceDiagram',
        async (item: AppMapTreeItem) => {
          vscode.commands.executeCommand('appmap.sequenceDiagram', item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.deleteAppMap',
        async (item: AppMapTreeItem) => {
          await deleteAppMap(item.descriptor.resourceUri);
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.deleteAppMaps',
        async (item: RootTreeItem) => {
          deleteFolderAppMaps(appmaps, AppMapTreeDataProvider.folderName(item.folderProperties));
        }
      )
    );
    context.subscriptions.push(
      vscode.commands.registerCommand(
        'appmap.context.compareSequenceDiagrams',
        async (item: AppMapTreeItem) => {
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
