import * as vscode from 'vscode';
import AppMapCollectionFile from '../services/appmapCollectionFile';
import { ProjectStateServiceInstance } from '../services/projectStateService';
import { promptForAppMap } from '../lib/promptForAppMap';

export function findByName(
  context: vscode.ExtensionContext,
  projectStates: ProjectStateServiceInstance[],
  appmapCollectionFile: AppMapCollectionFile
) {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.findByName', async () => {
      const appmapFileName = await promptForAppMap(
        projectStates,
        appmapCollectionFile.allAppMaps()
      );
      if (!appmapFileName) return;

      vscode.commands.executeCommand('vscode.open', appmapFileName);
    })
  );
}
