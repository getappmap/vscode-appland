import * as vscode from 'vscode';
import SignInManager from '../services/signInManager';
import ExtensionState from '../configuration/extensionState';

export default function tryOpenNavie(extensionState: ExtensionState): vscode.Disposable {
  return vscode.commands.registerCommand('appmap.tryOpenNavie', async () => {
    if (!extensionState.hasViewedNavie && !SignInManager.shouldShowSignIn()) {
      extensionState.hasViewedNavie = true;
      await vscode.commands.executeCommand('appmap.explain');
    }
  });
}
