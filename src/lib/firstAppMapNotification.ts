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
    // This opens the Explore AppMaps page
    vscode.commands.executeCommand('appmap.openInstallGuide', 'open-appmaps');
    // We want to give focus to AppMaps tree.
    // We need to wait a bit because previous command triggers the
    // appmap.view.focusCodeObjects command and Code Objects get focus
    // instead of AppMaps.
    setTimeout(() => vscode.commands.executeCommand('appmap.view.focusAppMaps'), 1000);
  }
}
