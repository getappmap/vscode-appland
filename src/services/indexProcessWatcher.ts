import { NodeProcessService } from './nodeProcessService';
import { ConfigFileProvider, ProcessWatcher } from './processWatcher';

export default class IndexProcessWatcher extends ProcessWatcher {
  constructor(
    configFileProvider: ConfigFileProvider,
    modulePath: string,
    appmapDir: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    super(configFileProvider, {
      id: 'index',
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args: ['index', '--watch', '--appmap-dir', appmapDir],
      cwd,
      env,
    });
  }
}
