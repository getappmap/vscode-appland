import * as vscode from 'vscode';
import { ChildProcess, OutputStream, spawn, SpawnOptions } from './nodeDependencyProcess';

export type RetryOptions = {
  // The number of retries made before declaring the process as failed.
  retryTimes?: number;

  // The number of milliseconds that must elapse before the retry counter is reset.
  retryThreshold?: number;

  // A function that returns the number of milliseconds to back off for the next retry.
  retryBackoff?: (retryNumber: number) => number;
};

export type ProcessWatcherOptions = {
  id: string;
} & RetryOptions &
  SpawnOptions;

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  retryTimes: 3,
  retryThreshold: 3 * 60 * 1000,
  retryBackoff: (retryNumber: number) => Math.pow(2, retryNumber) * 1000,
};

export type ConfigFileProvider = () => Promise<vscode.Uri[]>;

export class ProcessWatcher implements vscode.Disposable {
  public process?: ChildProcess;
  protected options: ProcessWatcherOptions & Required<RetryOptions>;
  protected _onError: vscode.EventEmitter<Error> = new vscode.EventEmitter<Error>();
  protected _onAbort: vscode.EventEmitter<Error> = new vscode.EventEmitter<Error>();

  protected shouldRun = false;

  // The number of times this process has crashed.
  protected crashCount = 0;

  // A timeout period in which the crash count is to be reset if the timer is fulfilled.
  protected crashTimeout?: NodeJS.Timeout;

  // Process errors are reported via this event emitter
  public get onError(): vscode.Event<Error> {
    return this._onError.event;
  }

  // This event emitter is fired once the process has crashed more than the `retryTimes` threshold and
  // will not be retried.
  public get onAbort(): vscode.Event<Error> {
    return this._onAbort.event;
  }

  public get id(): string {
    return this.options.id;
  }

  constructor(protected configFileProvider: ConfigFileProvider, options: ProcessWatcherOptions) {
    this.options = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
    };
  }

  get running(): boolean {
    return this.process !== undefined;
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

  async canStart(): Promise<{ enabled: boolean; reason?: string }> {
    const configFiles = await this.configFileProvider();
    if (configFiles.length === 0) return { enabled: false, reason: 'appmap.yml does not exist' };

    return { enabled: true };
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async start(): Promise<void> {
    const options = { ...this.options };
    options.env = { ...options.env, ...(await this.loadEnvironment()) };

    // If this.process is undefined, don't await until after this.process is set, or the process may be started twice.
    if (this.process) {
      this.process.log.append(
        `${(options.args || [])[0]} process (${this.process.pid}) already running`
      );
      return;
    }

    this.shouldRun = true;
    this.process = spawn(options);
    this.process.log.append(
      `spawned ${this.process.spawnargs.join(' ')} with options ${JSON.stringify(options)}`
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
    if (this.process) {
      this.process.log.append(
        `${this.process?.spawnargs.join(' ')} process has been stopped` +
          (reason ? `: ${reason}` : '')
      );
      this.process.kill();
      this.process = undefined;
    }
  }

  protected async loadEnvironment(): Promise<NodeJS.ProcessEnv> {
    return {};
  }

  dispose(): void {
    this.stop();
    this._onAbort.dispose();
    this._onError.dispose();
  }
}
