import * as vscode from 'vscode';
import { ChildProcess, OutputStream, spawn, SpawnOptions } from './nodeDependencyProcess';
import { getApiKey } from '../authentication';
import isActivated from '../authentication/isActivated';
import { getCustomerId } from '../configuration/customerId';
import assert from 'assert';
import { fileExists, sanitizeEnvironment } from '../util';
import { join } from 'path';
import ExtensionSettings from '../configuration/extensionSettings';
import { getSecretEnv } from './navieConfigurationService';
import { killGracefully } from './killGracefully';

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

// Excludes ProcessId.RPC intentionally: the RPC process isn't enrolled as a per-workspace
// NodeProcessServiceInstance watcher (it's owned singly by RpcProcessService, independent of
// any one workspace folder), so it never appears in NodeProcessServiceInstance.processes.
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

  // Tracks a start() call in flight, so a concurrent start() can await the same
  // spawn instead of racing it and spawning a second process.
  private startPromise?: Promise<void>;
  private startGeneration = 0;

  // Bumped by every stop. A start that was assembling its environment when a stop landed
  // belongs to the generation before it, and must not go on to spawn: stop() had nothing to
  // kill at the time, so the process would outlive the watcher that asked for it. Counting
  // rather than waiting keeps stop() -- and so dispose(), and so extension shutdown -- from
  // blocking on whatever a start is waiting for, such as secret storage.
  private generation = 0;

  // A timeout period in which the crash count is to be reset if the timer is fulfilled.
  protected crashTimeout?: NodeJS.Timeout;

  public get configFolder(): string {
    const { cwd } = this.options;
    assert(cwd, 'cwd is not defined');
    const dir = cwd instanceof URL ? cwd.pathname : cwd.toString();
    return dir;
  }

  // Process errors are reported via this event emitter. It fires once per run of crashes,
  // not once per failed attempt; see reportFailure.
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

  // `failed` is the process that died, which is not necessarily the one the watcher owns --
  // neither on the way in, nor by the time the backoff below is over.
  protected async retry(failed: ChildProcess): Promise<void> {
    // A process the watcher has moved on from can still report a failure: stop() drops the
    // exit listener but not the error one. The crash counter belongs to whatever is running
    // now, and spending it here would cost the replacement a retry, suppress the report of
    // its first crash, and eventually abort the watcher over a process that is running
    // perfectly well.
    if (!this.shouldRun || this.process !== failed) return;

    if (this.crashTimeout) {
      clearTimeout(this.crashTimeout);
      this.crashTimeout = undefined;
    }

    this.crashCount++;
    if (this.crashCount > this.options.retryTimes) {
      failed.log.append('too many crashes - aborting', OutputStream.Stderr);
      this._onAbort.fire(new Error(`${failed.spawnargs.join(' ')} crashed too many times.`));
      if (this.process === failed) this.process = undefined;
      this.hasAborted = true;
      return;
    }

    const backoffTime = this.options.retryBackoff(this.crashCount);
    failed.log.append(
      `backing off for ${(backoffTime / 1000).toFixed(0)} seconds before restarting`,
      OutputStream.Stderr
    );
    await new Promise((resolve) => setTimeout(resolve, backoffTime));

    // A stop, or a stop and a start, may have happened while we were backing off. Either
    // way the watcher has moved on from the process this retry was for, and replacing it
    // now would drop the watcher's reference to a live process and spawn a second one
    // beside it.
    if (this.process !== failed) return;

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
    // installation is activated, so its indexer and scanner have to run.
    if (!(await isActivated(this.context)))
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

    if (this.process) {
      this.process.log.append(
        `${(this.options.args || [])[0]} process (${this.process.pid}) already running`
      );
      return;
    }

    // A start may already be in flight, awaiting loadEnvironment() below. Share its promise
    // rather than racing it, or the process may be started twice -- but only if no stop has
    // landed since, because a start from before one has been abandoned and will spawn
    // nothing. This call wants a running process, so it has to do the work itself.
    if (this.startPromise && this.startGeneration === this.generation) return this.startPromise;

    this.startGeneration = this.generation;
    const starting = this.doStart().finally(() => {
      if (this.startPromise === starting) this.startPromise = undefined;
    });
    this.startPromise = starting;
    return starting;
  }

  private async doStart(): Promise<void> {
    const generation = this.generation;
    const options = { ...this.options };
    options.env = { ...options.env, ...(await loadEnvironment(this.context)) };

    // Stopped while we were assembling the environment. Spawning now would leave a process
    // nobody is watching: the stop that was meant to prevent it has already been and gone.
    if (this.generation !== generation) return;

    this.shouldRun = true;
    const started = spawn(options);
    this.process = started;

    const sanitizedOptions = { ...options };
    if (sanitizedOptions.env) sanitizedOptions.env = sanitizeEnvironment(sanitizedOptions.env);
    started.log.append(
      `spawned ${started.spawnargs.join(' ')} with options ${JSON.stringify(sanitizedOptions)}`
    );

    started.once('error', (err) => {
      this.reportFailure(err);
      this.retry(started);
    });

    started.once('exit', (code, signal) => {
      // stop() removes this listener, so an exit that arrives here was never asked for --
      // unless a stop raced the exit and cleared shouldRun first, which is the one case
      // where there is nothing to report and nothing to restart. How the process died says
      // nothing about whether we wanted it to: a supervisor tearing down the tree can
      // SIGKILL, and something killing this child alone can SIGTERM. Our own intent is what
      // shouldRun records, so that is what decides, for every kind of exit alike.
      if (!this.shouldRun) return;

      const how = signal ? `signal ${signal}` : `code ${code ?? 0}`;
      this.reportFailure(new Error(`${started.spawnargs.join(' ')} exited with ${how}`));
      this.retry(started);
    });
  }

  // The failures that follow the first one are the same fault repeating on a backoff, so
  // only the first since the crash counter was last clear is worth an event -- otherwise a
  // process that never starts reports retryTimes + 1 identical exceptions per incident, and
  // the abort below says the rest. The counter is what the watcher itself uses to decide
  // what counts as one run of crashes, so reporting follows it rather than keeping its own
  // notion of an incident.
  private reportFailure(error: Error): void {
    if (this.crashCount === 0) this._onError.fire(error);
  }

  async stop(reason?: string): Promise<void> {
    this.crashCount = 0;
    this.shouldRun = false;
    this.generation++;

    if (this.crashTimeout) clearTimeout(this.crashTimeout);
    const proc = this.process;
    if (!proc) return;

    this.process = undefined;
    proc.removeAllListeners('exit');
    if (await killGracefully(proc)) {
      proc.log.append(
        `${proc.spawnargs.join(' ')} process has been stopped` + (reason ? `: ${reason}` : '')
      );
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
