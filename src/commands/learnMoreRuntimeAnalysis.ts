import * as vscode from 'vscode';

export default async function learnMoreRuntimeAnalysis(
  context: vscode.ExtensionContext
): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.learnMoreRuntimeAnalysis', async () => {
    await vscode.commands.executeCommand('appmap.openInstallGuide', 'investigate-findings');
  });
  context.subscriptions.push(command);
}
