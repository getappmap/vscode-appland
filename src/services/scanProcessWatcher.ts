import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher } from './processWatcher';

export default class ScanProcessWatcher extends ProcessWatcher {
  constructor(
    context: vscode.ExtensionContext,
    modulePath: string | undefined,
    binPath: string,
    appmapDir: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    const args = ['scan', '--watch', '--appmap-dir', appmapDir];
    if (ExtensionSettings.appMapCommandLineVerbose) args.push('--verbose');
    super(context, {
      id: ProcessId.Analysis,
      modulePath,
      binPath,
      log: NodeProcessService.outputChannel,
      args,
      cwd,
      env,
    });
  }
}
