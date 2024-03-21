import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';

export default class RpcProcessWatcher extends ProcessWatcher {
  private readonly _onRpcPortChange: vscode.EventEmitter<number> =
    new vscode.EventEmitter<number>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;
  public rpcPort?: number;
  private stdoutBuffer = '';

  constructor(context: vscode.ExtensionContext, modulePath: string, env?: NodeJS.ProcessEnv) {
    const args = ['rpc', '--port', '0'];
    const extraOptions = ExtensionSettings.appMapIndexOptions;
    if (extraOptions) args.push(...extraOptions.split(' '));
    if (ExtensionSettings.appMapCommandLineVerbose) args.push('--verbose');
    const options: ProcessWatcherOptions = {
      id: ProcessId.RPC,
      modulePath: modulePath,
      log: NodeProcessService.outputChannel,
      args,
      env,
    };
    super(context, options);
  }

  // Override
  public isDirectoryConfigured(): Promise<boolean> {
    // The RPC server runs regardless of whether a directory is configured.
    return Promise.resolve(true);
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
      this._onRpcPortChange.fire(this.rpcPort);
    }
  }

  dispose(): void {
    this._onRpcPortChange.dispose();
    super.dispose();
  }
}
