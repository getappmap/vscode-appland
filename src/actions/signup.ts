import * as vscode from 'vscode';
import { AUTHN_PROVIDER_NAME } from '../authentication';
import extensionSettings from '../configuration/extensionSettings';
import AnalysisManager from '../services/analysisManager';
import { ANALYSIS_CTA_INTERACTION, Telemetry } from '../telemetry';
export class Signup {
  public static async forAnalysis(): Promise<boolean> {
    if (AnalysisManager.isAnalysisEnabled) {
      return true;
    }

    Telemetry.sendEvent(ANALYSIS_CTA_INTERACTION);

    const session = await vscode.authentication.getSession(AUTHN_PROVIDER_NAME, ['default'], {
      createIfNone: true,
    });

    if (!session) return false;

    await extensionSettings.enableFindings();

    return true;
  }
}