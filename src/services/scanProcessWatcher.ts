import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher } from './processWatcher';

export default class ScanProcessWatcher extends ProcessWatcher {
  constructor(modulePath: string, appmapDir: string, cwd: string, env?: NodeJS.ProcessEnv) {
    const args = ['scan', '--watch', '--appmap-dir', appmapDir];
    if (ExtensionSettings.appMapCommandLineVerbose) args.push('--verbose');
    super({
      id: ProcessId.Analysis,
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args,
      cwd,
      env,
    });
  }
}
