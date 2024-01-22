import ExtensionSettings from '../configuration/extensionSettings';
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
    const args = ['scan', '--watch', '--appmap-dir', appmapDir];
    if (ExtensionSettings.appMapCommandLineVerbose) args.push('--verbose');
    super(configFileProvider, {
      id: ProcessId.Analysis,
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args,
      cwd,
      env,
    });
  }
}
