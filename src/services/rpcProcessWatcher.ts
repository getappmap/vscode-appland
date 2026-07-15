import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';
import AssetService from '../assets/assetService';
import { AssetIdentifier } from '../assets';
import LineBuffer from './lineBuffer';

export default class RpcProcessWatcher extends ProcessWatcher {
  private readonly _onRpcPortChange: vscode.EventEmitter<number> =
    new vscode.EventEmitter<number>();
  public readonly onRpcPortChange = this._onRpcPortChange.event;
  public rpcPort?: number;
  private readonly lineBuffer = new LineBuffer();

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

    // Process each line individually to ensure we accurately detect the RPC port
    // every time the server announces it.
    for (const line of this.lineBuffer.push(data)) {
      const match = line.match(/^Running JSON-RPC server on port: (\d+)$/);
      if (match) {
        this.consumeRpcPort(match[1]);
      }
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
