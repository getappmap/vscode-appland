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

export type ProcessWatcherOptions = RetryOptions & SpawnOptions;

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  retryTimes: 3,
  retryThreshold: 3 * 60 * 1000,
  retryBackoff: (retryNumber: number) => Math.pow(2, retryNumber) * 1000,
};

export class ProcessWatcher implements vscode.Disposable {
  public process?: ChildProcess;
  protected options: ProcessWatcherOptions & Required<RetryOptions>;
  protected _onError: vscode.EventEmitter<Error> = new vscode.EventEmitter<Error>();
  protected _onAbort: vscode.EventEmitter<Error> = new vscode.EventEmitter<Error>();

  // The number of times this process has crashed.
  protected crashCount = 0;

  // Indicates the process has crashed more than the `retryTimes` threshold.
  protected aborted = false;

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

  constructor(options: ProcessWatcherOptions) {
    this.options = {
      ...DEFAULT_RETRY_OPTIONS,
      ...options,
    };
  }

  protected async retry(): Promise<void> {
    if (this.aborted) {
      throw new Error('the process has already been aborted');
    }

    if (this.crashTimeout) {
      clearTimeout(this.crashTimeout);
      this.crashTimeout = undefined;
    }

    this.crashCount++;
    if (this.crashCount > this.options.retryTimes) {
      this.process?.log.append('too many crashes - aborting', OutputStream.Stderr);
      this._onAbort.fire(new Error(`${this.process?.spawnargs.join(' ')} crashed too many times.`));
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

    this.start();
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error(`process (${this.process.pid}) already running`);
    }

    if (this.aborted) {
      throw new Error('the process has already been aborted');
    }

    this.process = await spawn(this.options);
    this.process.log.append(`spawned ${this.process.spawnargs.join(' ')}`);

    this.process.once('error', (err) => {
      this._onError.fire(err);
      this.retry();
    });

    this.process.once('exit', (code, signal) => {
      if (code && code !== 0) {
        const msg = `${this.process?.spawnargs.join(' ')} exited with code ${code}`;
        this._onError.fire(new Error(msg));
      } else if (signal) {
        const msg = `${this.process?.spawnargs.join(' ')} exited with signal ${signal}`;
        this._onError.fire(new Error(msg));
      }
      this.retry();
    });
  }

  dispose(): void {
    if (this.process) {
      this.aborted = true;
      this.process.kill();
      this.process = undefined;
    }

    if (this.crashTimeout) {
      clearInterval(this.crashTimeout);
    }

    this._onAbort.dispose();
    this._onError.dispose();
  }
}
