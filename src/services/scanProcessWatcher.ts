import AppMapServerAuthenticationProvider from '../authentication/appmapServerAuthenticationProvider';
import ExtensionSettings from '../configuration/extensionSettings';
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

  async canStart(): Promise<{ enabled: boolean; reason?: string }> {
    if (!ExtensionSettings.findingsEnabled)
      return { enabled: false, reason: 'appMap.findingsEnabled is false' };

    if (!(await this.accessToken()))
      return { enabled: false, reason: 'User is not logged in to AppMap' };

    return { enabled: true };
  }

  async accessToken(): Promise<string | undefined> {
    return AppMapServerAuthenticationProvider.getApiKey(false);
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
