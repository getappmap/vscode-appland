import * as vscode from 'vscode';

import AssetManager from '../services/assetManager';

export default async function downloadLatestJavaJar(
  context: vscode.ExtensionContext
): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.downloadLatestJavaJar', async () => {
    try {
      await AssetManager.getLatestJavaJar();
      vscode.window.showInformationMessage('AppMap usage state was reset.');
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(`Failed to download latest Java jar: ${err.message}`);
    }
  });

  context.subscriptions.push(command);
}
