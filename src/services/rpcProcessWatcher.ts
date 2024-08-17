import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';
import AssetService, { AssetIdentifier } from '../assets/assetService';

export default class RpcProcessWatcher extends ProcessWatcher {
  private readonly _onRpcPortChange: vscode.EventEmitter<number> =
    new vscode.EventEmitter<number>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;
  public rpcPort?: number;
  private stdoutBuffer = '';

  constructor(context: vscode.ExtensionContext, modulePath?: string, env?: NodeJS.ProcessEnv) {
    const args = makeArgs();
    const extraOptions = ExtensionSettings.appMapIndexOptions;
    if (extraOptions) args.push(...extraOptions.split(' '));
    if (ExtensionSettings.appMapCommandLineVerbose) args.push('--verbose');
    const options: ProcessWatcherOptions = {
      id: ProcessId.RPC,
      modulePath,
      binPath: AssetService.getAssetPath(AssetIdentifier.AppMapCli),
      log: NodeProcessService.outputChannel,
      args,
      env,
    };
    super(context, options);

    this.rpcPort = ExtensionSettings.navieRpcPort;
    if (this.rpcPort) {
      this.options.log?.appendLine(
        `Using RPC port assigned by extension setting appMap.navie.rpcPort: ${this.rpcPort}`
      );
    }
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

    // Wait for the RPC port to be logged, and detect it.
    // If a project setting overrides the port, report that port instead.

    this.stdoutBuffer += data;
    const lines = this.stdoutBuffer.split('\n');
    this.stdoutBuffer = this.stdoutBuffer.slice(-100);

    const detectRpcPort = () =>
      lines
        .map((line) => {
          const match = line.match(/^Running JSON-RPC server on port: (\d+)$/);
          if (match) return match[1];
        })
        .find(Boolean);

    const consumeRpcPort = (portStr: string) => {
      this.options.log?.appendLine(`AppMap RPC process listening on port ${portStr}`);
      const { navieRpcPort } = ExtensionSettings;
      if (navieRpcPort) {
        this.rpcPort = navieRpcPort;
        this.options.log?.appendLine(
          `The RPC port will be overwritten by extension setting appMap.navie.rpcPort: ${this.rpcPort}`
        );
      } else {
        this.rpcPort = parseInt(portStr);
        this.options.args = makeArgs(this.rpcPort);
      }
      this._onRpcPortChange.fire(this.rpcPort);
    };

    const portStr = detectRpcPort();
    if (portStr) consumeRpcPort(portStr);
  }

  dispose(): void {
    this._onRpcPortChange.dispose();
    super.dispose();
  }
}

function makeArgs(port = 0) {
  return ['rpc', '--port', port.toFixed()];
}
