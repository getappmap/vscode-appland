import * as vscode from 'vscode';

import AssetService from '../assets/assetService';
import { AssetIdentifier } from '../assets';

export default async function downloadLatestJavaJar(
  context: vscode.ExtensionContext
): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.downloadLatestJavaJar', async () => {
    try {
      await AssetService.updateOne(AssetIdentifier.JavaAgent);
      vscode.window.showInformationMessage('appmap.jar has been successfully updated');
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(`Failed to download latest Java jar: ${err.message}`);
    }
  });

  context.subscriptions.push(command);
}
