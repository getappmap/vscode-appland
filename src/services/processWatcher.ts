import * as vscode from 'vscode';
import { ChildProcess, OutputStream, spawn, SpawnOptions } from './nodeDependencyProcess';
import { getApiKey } from '../authentication';
import { getCustomerId, isEntitled } from '../configuration/customerId';
import assert from 'assert';
import { fileExists, sanitizeEnvironment } from '../util';
import { join } from 'path';
import ExtensionSettings from '../configuration/extensionSettings';
import { getSecretEnv } from './navieConfigurationService';

export type RetryOptions = {
  // The number of retries made before declaring the process as failed.
  retryTimes?: number;

  // The number of milliseconds that must elapse before the retry counter is reset.
  retryThreshold?: number;

  // A function that returns the number of milliseconds to back off for the next retry.
  retryBackoff?: (retryNumber: number) => number;
};

export enum ProcessId {
  Index = 'index',
  Analysis = 'analysis',
  RPC = 'rpc',
}

export const AllProcessIds = [ProcessId.Index, ProcessId.Analysis];

export type ProcessWatcherOptions = {
  id: ProcessId;
} & RetryOptions &
  SpawnOptions;

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  retryTimes: 3,
  retryThreshold: 3 * 60 * 1000,
  retryBackoff: (retryNumber: number) => Math.pow(2, retryNumber) * 1000,
};

// List appamp.yml files across all workspaces.
export interface ConfigFileProvider {
  files(): Promise<vscode.Uri[]>;
  reset(): void;
}

async function accessToken(): Promise<string | undefined> {
  return getApiKey(false);
}

export async function loadEnvironment(
  context: vscode.ExtensionContext
): Promise<NodeJS.ProcessEnv> {
  const apiKey = await accessToken();
  const customerId = getCustomerId(context);

  const env: Record<string, string | undefined> = {
    APPMAP_API_URL: ExtensionSettings.apiUrl,
    // Omitted rather than faked when there is no session: a customer ID is an entitlement,
    // not a credential, and the CLI must not mistake one for the other. Both are passed when
    // both exist — the API key wins for authentication, the customer ID is attribution-only.
    ...(apiKey ? { APPMAP_API_KEY: apiKey } : undefined),
    ...(customerId ? { APPMAP_CUSTOMER_ID: customerId } : undefined),
    ...(await getSecretEnv(context)),
    ...ExtensionSettings.appMapCommandLineEnvironment,
  };

  return env;
}

export class ProcessWatcher implements vscode.Disposable {
  public process?: ChildProcess;
  public crashCount = 0;
  public options: ProcessWatcherOptions & Required<RetryOptions>;

  protected _onError: vscode.EventEmitter<Error> = new vscode.EventEmitter<Error>();
  protected _onAbort: vscode.EventEmitter<Error> = new vscode.EventEmitter<Error>();
  protected _onBeforeRestart: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();

  protected shouldRun = false;
  protected hasAborted = false;
  protected disposed = false;

  // A timeout period in which the crash count is to be reset if the timer is fulfilled.
  protected crashTimeout?: NodeJS.Timeout;

  public get configFolder(): string {
    const { cwd } = this.options;
    assert(cwd, 'cwd is not defined');
    const dir = cwd instanceof URL ? cwd.pathname : cwd.toString();
    return dir;
  }

  // Process errors are reported via this event emitter
  public get onError(): vscode.Event<Error> {
    return this._onError.event;
  }

  // This event emitter is fired once the process has crashed more than the `retryTimes` threshold and
  // will not be retried.
  public get onAbort(): vscode.Event<Error> {
    return this._onAbort.event;
  }

  // Fired when the process is restarted.
  public get onBeforeRestart(): vscode.Event<void> {
    return this._onBeforeRestart.event;
  }

  public get id(): ProcessId {
    return this.options.id;
  }

  constructor(private context: vscode.ExtensionContext, options: ProcessWatcherOptions) {
    this.options = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
      stdoutListener: this.onStdout.bind(this),
    };
  }

  get running(): boolean {
    return this.process !== undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onStdout(_data: string): void {
    // Available in subclasses.
  }

  protected async retry(): Promise<void> {
    if (!this.shouldRun) return;
    if (this.crashTimeout) {
      clearTimeout(this.crashTimeout);
      this.crashTimeout = undefined;
    }

    this.crashCount++;
    if (this.crashCount > this.options.retryTimes) {
      this.process?.log.append('too many crashes - aborting', OutputStream.Stderr);
      this._onAbort.fire(new Error(`${this.process?.spawnargs.join(' ')} crashed too many times.`));
      this.process = undefined;
      this.hasAborted = true;
      return;
    }

    const backoffTime = this.options.retryBackoff(this.crashCount);
    this.process?.log.append(
      `backing off for ${(backoffTime / 1000).toFixed(0)} seconds before restarting`,
      OutputStream.Stderr
    );
    await new Promise((resolve) => setTimeout(resolve, backoffTime));
    this.crashTimeout = setTimeout(() => (this.crashCount = 0), this.options.retryThreshold);
    this.process = undefined;
    if (this.shouldRun) this.start();
  }

  async isDirectoryConfigured(): Promise<boolean> {
    return await fileExists(join(this.configFolder, 'appmap.yml'));
  }

  async canStart(): Promise<{ enabled: boolean; reason?: string }> {
    if (this.hasAborted) return { enabled: false, reason: 'process has crashed too many times' };

    if (!(await this.isDirectoryConfigured()))
      return {
        enabled: false,
        reason: `Project directory '${this.configFolder}' is not configured (does not have appmap.yml)`,
      };

    // Entitlement stands in for a session here as it does everywhere else: an entitled
    // installation is authenticated, so its indexer and scanner have to run. Checked first so
    // that an entitled user never reaches getApiKey — this is polled once a second.
    if (!isEntitled(this.context) && !(await accessToken()))
      return { enabled: false, reason: 'User is not logged in to AppMap' };

    return { enabled: true };
  }

  async restart(): Promise<void> {
    this._onBeforeRestart.fire();
    await this.stop();
    await this.start();
  }

  async start(): Promise<void> {
    assert(!this.disposed, 'ProcessWatcher has already been disposed');
    const options = { ...this.options };
    options.env = { ...options.env, ...(await loadEnvironment(this.context)) };

    // If this.process is undefined, don't await until after this.process is set, or the process may be started twice.
    if (this.process) {
      this.process.log.append(
        `${(options.args || [])[0]} process (${this.process.pid}) already running`
      );
      return;
    }

    this.shouldRun = true;
    this.process = spawn(options);

    const sanitizedOptions = { ...options };
    if (sanitizedOptions.env) sanitizedOptions.env = sanitizeEnvironment(sanitizedOptions.env);
    this.process.log.append(
      `spawned ${this.process.spawnargs.join(' ')} with options ${JSON.stringify(sanitizedOptions)}`
    );

    this.process.once('error', (err) => {
      this._onError.fire(err);
      this.retry();
    });

    this.process.once('exit', (code, signal) => {
      if (code && code !== 0) {
        const msg = `${this.process?.spawnargs.join(' ')} exited with code ${code}`;
        this._onError.fire(new Error(msg));
      } else if (signal) {
        // Make sure we're not killing our own process before firing off an error
        if (!this.shouldRun) return;

        const msg = `${this.process?.spawnargs.join(' ')} exited with signal ${signal}`;
        this._onError.fire(new Error(msg));
      }
      this.retry();
    });
  }

  async stop(reason?: string): Promise<void> {
    this.crashCount = 0;
    this.shouldRun = false;

    if (this.crashTimeout) clearTimeout(this.crashTimeout);
    const proc = this.process;
    if (proc) {
      this.process = undefined;
      proc.removeAllListeners('exit');
      const killTimer = setTimeout(() => proc.kill('SIGKILL'), 1000).unref(); // in case SIGTERM didn't work
      let result: Promise<void> | void = new Promise<void>((resolve) =>
        proc.once('exit', () => {
          clearTimeout(killTimer);
          proc.log.append(
            `${proc.spawnargs.join(' ')} process has been stopped` + (reason ? `: ${reason}` : '')
          );
          resolve();
        })
      );
      if (!proc.kill()) result = undefined;
      return result;
    }
  }

  dispose(): void {
    this.disposed = true;
    // TODO: There's no await here, so onAbort and onError will not be fired.
    this.stop();
    this._onAbort.dispose();
    this._onError.dispose();
  }
}
