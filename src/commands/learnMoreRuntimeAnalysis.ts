import * as vscode from 'vscode';
import { ANALYSIS_CTA_INTERACTION, Telemetry } from '../telemetry';

export default async function learnMoreRuntimeAnalysis(
  context: vscode.ExtensionContext
): Promise<void> {
  const command = vscode.commands.registerCommand('appmap.learnMoreRuntimeAnalysis', async () => {
    Telemetry.sendEvent(ANALYSIS_CTA_INTERACTION, { id: 'learn-more' });
    await vscode.commands.executeCommand('appmap.openInstallGuide', 'investigate-findings');
  });
  context.subscriptions.push(command);
}
