import * as vscode from 'vscode';

import { NodeProcessService } from './nodeProcessService';
import {
  ConfigFileProvider,
  ProcessId,
  ProcessWatcher,
  ProcessWatcherOptions,
} from './processWatcher';

export default class IndexProcessWatcher extends ProcessWatcher {
  public rpcPort?: number;
  stdoutBuffer = '';

  constructor(
    configFileProvider: ConfigFileProvider,
    modulePath: string,
    appmapDir: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    const options: ProcessWatcherOptions = {
      id: ProcessId.Index,
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args: ['index', '--watch', '--port', '0', '--appmap-dir', appmapDir],
      cwd,
      env,
    };
    super(configFileProvider, options);
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
      vscode.window.showInformationMessage(`AppMap index process listening on port ${portStr}`);
      this.rpcPort = parseInt(portStr);
    }
  }
}
