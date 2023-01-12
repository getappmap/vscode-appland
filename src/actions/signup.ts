import AppMapServerAuthenticationProvider from '../authentication/appmapServerAuthenticationProvider';
import extensionSettings from '../configuration/extensionSettings';
import AnalysisManager from '../services/analysisManager';
import { ANALYSIS_CTA_INTERACTION, Telemetry } from '../telemetry';
export class Signup {
  public static async forAnalysis(): Promise<boolean> {
    if (AnalysisManager.isAnalysisEnabled) {
      return true;
    }

    Telemetry.sendEvent(ANALYSIS_CTA_INTERACTION);

    const appmapApiKey = await AppMapServerAuthenticationProvider.getApiKey(true);
    if (!appmapApiKey) return false;

    await extensionSettings.enableFindings();

    return true;
  }
}
