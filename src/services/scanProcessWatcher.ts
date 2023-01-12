import AppMapServerAuthenticationProvider from '../authentication/appmapServerAuthenticationProvider';
import AnalysisManager from './analysisManager';
import { NodeProcessService } from './nodeProcessService';
import { ProcessWatcher } from './processWatcher';

export default class ScanProcessWatcher extends ProcessWatcher {
  constructor(modulePath: string, appmapDir: string, cwd: string, env?: NodeJS.ProcessEnv) {
    super({
      id: 'analysis',
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args: ['scan', '--watch', '--appmap-dir', appmapDir],
      cwd,
      env,
    });
  }

  async canStart(): Promise<boolean> {
    return AnalysisManager.isAnalysisEnabled && !!(await this.accessToken());
  }

  async accessToken(): Promise<string | undefined> {
    return await AppMapServerAuthenticationProvider.getApiKey(false);
  }

  protected async loadEnvironment(): Promise<NodeJS.ProcessEnv> {
    const env = await super.loadEnvironment();
    const accessToken = await this.accessToken();
    if (accessToken) {
      env.APPMAP_API_KEY = accessToken;
    }
    return env;
  }
}
