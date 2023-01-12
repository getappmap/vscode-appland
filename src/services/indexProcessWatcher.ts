import { NodeProcessService } from './nodeProcessService';
import { ProcessWatcher } from './processWatcher';

export default class IndexProcessWatcher extends ProcessWatcher {
  constructor(modulePath: string, appmapDir: string, cwd: string, env?: NodeJS.ProcessEnv) {
    super({
      id: 'index',
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args: ['index', '--watch', '--appmap-dir', appmapDir],
      cwd,
      env,
    });
  }
}
