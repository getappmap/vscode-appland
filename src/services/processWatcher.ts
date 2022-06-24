import { ChildProcess, spawn } from 'child_process';
import * as vscode from 'vscode';

export type ProcessWatcherOptions = {
  args: string[];

  // The directory to run the process in.
  cwd?: string;

  // The environment to run the process with.
  env?: NodeJS.ProcessEnv;

  // The number of retries made before declaring the process as failed.
  retryTimes?: number;

  // The number of milliseconds that must elapse before the retry counter is reset.
  retryThreshold?: number;

  // A function that returns the number of milliseconds to back off for the next retry.
  retryBackoff?: (retryNumber: number) => number;
};

const PROCESS_WATCHER_OPTIONS_DEFAULTS: Partial<ProcessWatcherOptions> = {
  retryTimes: 3,
  retryThreshold: 3 * 60 * 1000,
  retryBackoff: (retryNumber: number) => Math.pow(2, retryNumber) * 1000,
};

export class ProcessWatcher implements vscode.Disposable {
  public process?: ChildProcess;
  protected options: Required<ProcessWatcherOptions>;
  protected static outputChannel = vscode.window.createOutputChannel('AppMap: Services');
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
      ...PROCESS_WATCHER_OPTIONS_DEFAULTS,
      ...options,
    } as Required<ProcessWatcherOptions>;

    if (!this.options.args.length) {
      throw new Error('command arguments must be provided');
    }
  }

  protected log(channel: 'stdout' | 'stderr', message: string): void {
    ProcessWatcher.outputChannel.appendLine(`${this.process?.pid} [${channel}] ${message}`);
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
      this.log('stderr', 'too many crashes - aborting');
      this._onAbort.fire(new Error(`${this.process?.spawnargs.join(' ')} crashed too many times.`));
      return;
    }

    const backoffTime = this.options.retryBackoff(this.crashCount);
    this.log(
      'stderr',
      `backing off for ${(backoffTime / 1000).toFixed(0)} seconds before restarting`
    );
    await new Promise((resolve) => setTimeout(resolve, backoffTime));
    this.crashTimeout = setTimeout(() => (this.crashCount = 0), this.options.retryThreshold);
    this.process = undefined;

    this.start();
  }

  start(): void {
    if (this.process) {
      throw new Error(`process (${this.process.pid}) already running`);
    }

    if (this.aborted) {
      throw new Error('the process has already been aborted');
    }

    this.process = spawn(this.options.args[0], this.options.args.slice(1), {
      cwd: this.options.cwd,
      env: this.options.env,
    });

    this.log('stdout', `spawned ${this.process.spawnargs.join(' ')}`);

    const { stdout, stderr } = this.process;
    if (stdout) {
      stdout.setEncoding('utf8');
      stdout.on('data', (data) => this.log('stdout', data));
    }

    if (stderr) {
      stderr.setEncoding('utf8');
      stderr.on('data', (data) => this.log('stderr', data));
    }

    this.process.once('error', (err) => {
      this._onError.fire(err);
      this.retry();
    });

    this.process.once('exit', (code, signal) => {
      if (code && code !== 0) {
        const msg = `${this.process?.spawnargs.join(' ')} exited with code ${code}`;
        this.log('stderr', msg);
        this._onError.fire(new Error(msg));
      } else if (signal) {
        const msg = `${this.process?.spawnargs.join(' ')} exited with signal ${signal}`;
        this.log('stderr', msg);
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
