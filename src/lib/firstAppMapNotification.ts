import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';

export default async function checkAndTriggerFirstAppMapNotification(
  extensionState: ExtensionState
) {
  if (!extensionState.firstAppMapNotificationShown) {
    extensionState.firstAppMapNotificationShown = true;
    await showFirstAppMapNotification();
  }
}

async function showFirstAppMapNotification() {
  const selection = await vscode.window.showInformationMessage(
    "Congratulations! You've created your first AppMap.",
    'Try Navie'
  );

  if (selection === 'Try Navie') {
    vscode.commands.executeCommand('appmap.explain');
  }
}
