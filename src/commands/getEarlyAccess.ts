import * as vscode from 'vscode';
import ExtensionState from '../configuration/extensionState';
import { CTA_ID_EARLY_ACCESS_RT_ANALYSIS } from '../services/runtimeAnalysisCtaService';
import { CTA_INTERACT, Telemetry } from '../telemetry';

export const COMMAND_EARLY_ACCESS = 'appmap.getEarlyAccess';

export default function registerCommand(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMAND_EARLY_ACCESS,
      async (placement: 'sidebar' | 'notification') => {
        Telemetry.sendEvent(CTA_INTERACT, { id: CTA_ID_EARLY_ACCESS_RT_ANALYSIS, placement });
        vscode.env.openExternal(vscode.Uri.parse('https://appland.com/appmap-analysis.html'));
      }
    )
  );
}