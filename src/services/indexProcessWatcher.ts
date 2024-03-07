import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';

export default class IndexProcessWatcher extends ProcessWatcher {
  public rpcPort?: number;
  stdoutBuffer = '';

  constructor(
    context: vscode.ExtensionContext,
    modulePath: string,
    appmapDir: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    const args = ['index', '--watch', '--port', '0', '--appmap-dir', appmapDir];
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

  public isRpcAvailable(): boolean {
    return !!this.rpcPort;
  }

  protected onStdout(data: string): void {
    super.onStdout(data);

    this.stdoutBuffer += data;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = this.stdoutBuffer.slice(-100);

    const portStr = lines
      .map((line) => {
        const match = line.match(/^Running JSON-RPC server on port: (\d+)$/);
        if (match) return match[1];
      })
      .find(Boolean);
    if (portStr) {
      this.options.log?.appendLine(`AppMap index process listening on port ${portStr}`);
      this.rpcPort = parseInt(portStr);
    }
  }
}
