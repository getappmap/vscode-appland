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
    "You've created your first AppMap! Congratulations.",
    'Explore AppMaps'
  );

  if (selection === 'Explore AppMaps') {
    vscode.commands.executeCommand(
      'appmap.openInstallGuide',
      'open-appmaps',
      'appmap.view.focusAppMaps'
    );
  }
}
