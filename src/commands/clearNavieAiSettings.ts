import * as vscode from 'vscode';

export default function clearNavieAiSettings(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.clearNavieAiSettings', async () => {
      // Notifications can be hidden, so a modal dialog is necessary.
      const res = await vscode.window.showInformationMessage(
        'This will clear all existing AppMap Navie AI settings. Are you sure you want to continue?',
        { modal: true },
        'Continue'
      );

      if (res === 'Continue') {
        await vscode.workspace
          .getConfiguration('appMap')
          .update('commandLineEnvironment', undefined);
        await vscode.commands.executeCommand('appmap.openAIApiKey.set', '');
      }
    })
  );
}
