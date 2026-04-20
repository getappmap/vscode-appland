import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';
import AssetService from '../assets/assetService';
import { AssetIdentifier } from '../assets';

export default class RpcProcessWatcher extends ProcessWatcher {
  private readonly _onRpcPortChange: vscode.EventEmitter<number> =
    new vscode.EventEmitter<number>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;
  public rpcPort?: number;
  protected stdoutBuffer = '';

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

    this.stdoutBuffer += data;
    let lineEnd: number;
    // Process each line individually to ensure we accurately detect the RPC port
    // every time the server announces it.
    while ((lineEnd = this.stdoutBuffer.indexOf('\n')) !== -1) {
      const line = this.stdoutBuffer.slice(0, lineEnd).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(lineEnd + 1);

      const match = line.match(/^Running JSON-RPC server on port: (\d+)$/);
      if (match) {
        this.consumeRpcPort(match[1]);
      }
    }

    // Defensive truncation to prevent memory leaks in case the process outputs
    // an extremely long continuous string without any newline characters.
    if (this.stdoutBuffer.length > 1024) {
      this.stdoutBuffer = this.stdoutBuffer.slice(-1024);
    }
  }

  private consumeRpcPort(portStr: string) {
    this.options.log?.appendLine(`AppMap RPC process listening on port ${portStr}`);
    const { navieRpcPort } = ExtensionSettings;
    if (navieRpcPort) {
      this.rpcPort = navieRpcPort;
      this.options.log?.appendLine(
        `The RPC port will be overwritten by extension setting appMap.navie.rpcPort: ${this.rpcPort}`
      );
    } else {
      // make sure restarting the process uses the same port if it was dynamically assigned
      this.rpcPort = parseInt(portStr);
      this.options.args = makeArgs(this.rpcPort);
    }
    this._onRpcPortChange.fire(this.rpcPort);
  }

  async start(): Promise<void> {
    const disposables: vscode.Disposable[] = [];
    try {
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Window,
          cancellable: false,
          title: 'Starting Navie…',
        },
        () =>
          new Promise<void>((resolve, reject) => {
            disposables.push(this.onRpcPortChange(() => resolve()));
            disposables.push(this.onAbort(reject));
            super.start();
          })
      );
    } catch (e) {
      vscode.window.showErrorMessage(`Navie failed to start: ${e}`);
    } finally {
      disposables.forEach((d) => d.dispose());
    }
  }

  dispose(): void {
    this._onRpcPortChange.dispose();
    super.dispose();
  }
}

function makeArgs(port = 0) {
  return ['rpc', '--port', port.toFixed(), '--navie-provider', 'local'];
}
