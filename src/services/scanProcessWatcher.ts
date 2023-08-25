import { getApiKey } from '../authentication';
import { NodeProcessService } from './nodeProcessService';
import { ConfigFileProvider, ProcessId, ProcessWatcher } from './processWatcher';

export default class ScanProcessWatcher extends ProcessWatcher {
  constructor(
    configFileProvider: ConfigFileProvider,
    modulePath: string,
    appmapDir: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    super(configFileProvider, {
      id: ProcessId.Analysis,
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args: ['scan', '--watch', '--appmap-dir', appmapDir],
      cwd,
      env,
    });
  }

  async canStart(): Promise<{ enabled: boolean; reason?: string }> {
    const result = await super.canStart();
    if (!result.enabled) return result;

    if (!(await this.accessToken()))
      return { enabled: false, reason: 'User is not logged in to AppMap' };

    return { enabled: true };
  }

  async accessToken(): Promise<string | undefined> {
    return getApiKey(false);
  }

  protected async loadEnvironment(): Promise<NodeJS.ProcessEnv> {
    const env = await super.loadEnvironment();
    // KEG: Disable for now, seems to be breaking the scanner, possibly because the
    // remote domain is renamed from app.land to getappmap.com.
    // const accessToken = await this.accessToken();
    // if (accessToken) {
    //   env.APPMAP_API_KEY = accessToken;
    // }
    return env;
  }
}
