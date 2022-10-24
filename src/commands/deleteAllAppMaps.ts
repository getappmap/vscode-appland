import * as vscode from 'vscode';
import deleteAppMaps from '../lib/deleteAppMaps';
import AnalysisManager from '../services/analysisManager';
import ClassMapIndex from '../services/classMapIndex';

export default function deleteAllAppMaps(
  context: vscode.ExtensionContext,
  classMapIndex?: ClassMapIndex
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.deleteAllAppMaps', async () => {
      await Promise.all(
        (vscode.workspace.workspaceFolders || []).map((folder) => deleteAppMaps(folder.uri.fsPath))
      );

      const { findingsIndex } = AnalysisManager;
      findingsIndex?.clear();
      classMapIndex?.clear();
    })
  );
}
