import * as vscode from 'vscode';
import ExtensionSettings from '../configuration/extensionSettings';
import { NodeProcessService } from './nodeProcessService';
import { ProcessId, ProcessWatcher, ProcessWatcherOptions } from './processWatcher';
import LockfileSynchronizer from '../lib/lockfileSynchronizer';
import { ProgramName, getModulePath } from './nodeDependencyProcess';

// This class represents a single, global instance of the AppMap index process watcher.
// It is used in the absence of a workspace or AppMap configuration file.
// It does not watch the file system; It is only used as an RPC server.
export default class IndexProcessWatcherGlobal extends ProcessWatcher {
  private _onRpcPortChange = new vscode.EventEmitter<number | undefined>();
  private onRpcPortChange = this._onRpcPortChange.event;

  stdoutBuffer = '';

  constructor(
    context: vscode.ExtensionContext,
    modulePath: string,
    cwd: string,
    env?: NodeJS.ProcessEnv
  ) {
    const args = ['index', '--port', '0'];
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

  // TODO: This should be a little more sophisticated, but we can't call an async function from here.
  public isRpcAvailable(): boolean {
    return true;
  }

  // Override.
  // The global index process does not watch the file system, thus there is no directory to configure.
  isDirectoryConfigured(): Promise<boolean> {
    return Promise.resolve(false);
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
      const portNumber = parseInt(portStr, 10);
      this._onRpcPortChange.fire(portNumber);
    }
  }

  dispose(): void {
    super.dispose();
    this._onRpcPortChange.dispose();
    this.context.globalState.update('appmap.rpcPort', undefined);
  }

  public static async getRpcPort(context: vscode.ExtensionContext): Promise<number> {
    const mutex = new LockfileSynchronizer(context.extensionPath, {
      pollIntervalMs: 250,
      pollIntervalMsNoise: 250,
    });

    let rpcPort;
    await mutex.execute(async () => {
      rpcPort = await context.globalState.get<number>('appmap.rpcPort');

      // TODO: We should test the port to make sure it's viable.
      //       If the process is dead, we should start a new one.
      //       It's possible we just got stale state from an improperly disposed process.
      if (rpcPort) return;

      // The global index process is not running. We have the lock, so we'll start it.
      let modulePath: string;
      try {
        modulePath = await getModulePath({
          dependency: ProgramName.Appmap,
          globalStoragePath: context.globalStorageUri.fsPath,
        });
      } catch {
        vscode.window.showErrorMessage('The AppMap CLI is not installed.');
        return;
      }

      const watcher = new IndexProcessWatcherGlobal(context, modulePath, context.extensionPath);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for RPC port'));
        }, 60_000);

        const disposable = watcher.onRpcPortChange(async (port) => {
          rpcPort = port;
          await context.globalState.update('appmap.rpcPort', port);

          clearTimeout(timeout);
          disposable.dispose();

          resolve();
        });

        watcher.start();
      });
    });

    // If there's no RPC port, something went wrong.
    // Horribly wrong.
    // There's no fixing this.
    if (!rpcPort) {
      throw new Error('Failed to start index process');
    }

    return rpcPort;
  }
}
