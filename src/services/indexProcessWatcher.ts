import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';

export default class IndexProcessWatcher extends ProcessWatcher {
  constructor(
    context: vscode.ExtensionContext,
    modulePath: string,
    appmapDir: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    const args = ['index', '--watch', '--appmap-dir', appmapDir];
    const extraOptions = ExtensionSettings.appMapIndexOptions;
    if (extraOptions) args.push(...extraOptions.split(' '));
    if (ExtensionSettings.appMapCommandLineVerbose) args.push('--verbose');
    const options: ProcessWatcherOptions = {
      id: ProcessId.Index,
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args,
      cwd,
      env,
    };
    super(context, options);
  }
}
