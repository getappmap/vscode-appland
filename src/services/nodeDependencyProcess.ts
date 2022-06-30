import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';

export enum ProgramName {
  Appmap = 'appmap',
  Scanner = 'scanner',
}

export type WithLogCache = {
  log: ProcessLog;
};

export type ChildProcess = childProcess.ChildProcessWithoutNullStreams & WithLogCache;

export type SpawnOptions = {
  // Path to a bin script installed via yarn. If specified, it will be shifted into the command args
  // to be run via `node`
  binPath?: string;

  // Command line args given to `node` or the `bin` script specified
  args?: string[];

  // If specified, write log messages to the given output channel
  log?: vscode.OutputChannel;

  // Indicates whether or not log messages should be retained in a buffer
  cacheLog?: boolean;
} & Exclude<childProcess.SpawnOptionsWithoutStdio, 'argv0'>;

export type ProgramOptions = {
  // Name of the dependency to be resolved to a bin script path
  dependency: ProgramName;

  // This is neccesary for `yarn` to locate the bin script
  globalStoragePath: string;
};

export enum OutputStream {
  Stdout,
  Stderr,
}

export type ProcessLogItem = { stream: OutputStream; data: string };
export class ProcessLog extends Array<ProcessLogItem> {
  protected constructor(
    protected process: childProcess.ChildProcessWithoutNullStreams,
    protected outputChannel?: vscode.OutputChannel,
    protected shouldCache?: boolean
  ) {
    super();
  }

  static appendLogger(
    process: childProcess.ChildProcessWithoutNullStreams,
    outputChannel?: vscode.OutputChannel,
    cache?: boolean
  ): ChildProcess {
    if ((process as ChildProcess).log) {
      throw new Error(`process ${process.pid} already has a logger appended`);
    }

    const log = new ProcessLog(process, outputChannel, cache);

    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');
    process.stdout.on('data', (data) => log.appendLines(data, OutputStream.Stdout, true));
    process.stderr.on('data', (data) => log.appendLines(data, OutputStream.Stderr, true));
    process.once('error', (err) =>
      log.append(`an error occurred: ${String(err)}`, OutputStream.Stderr)
    );
    process.once('exit', (code, signal) => {
      const msg: string[] = ['exited'];
      if (code || !signal) {
        msg.push(`with code ${code || 0}`);
      } else {
        msg.push(`due to signal ${signal}`);
      }
      log.append(msg.join(' '), code === 0 ? OutputStream.Stdout : OutputStream.Stderr);
    });

    const modifiedProcess = process as ChildProcess;
    modifiedProcess.log = log;

    return modifiedProcess;
  }

  protected appendLines(data: string, stream = OutputStream.Stdout, cache = false): void {
    data
      .trim()
      .split('\n')
      .forEach((l) => this.append(l.trim(), stream, cache));
  }

  append(data: string, stream = OutputStream.Stdout, cache = false): void {
    if (this.shouldCache && cache) {
      this.push({ stream, data });
    }
    if (this.outputChannel) {
      this.outputChannel.appendLine(`${this.process?.pid} [${OutputStream[stream]}] ${data}`);
    }
  }

  toString(): string {
    return this.map((log) => `${log.stream}: ${log.data}`).join('\n');
  }
}

export async function getBinPath(options: ProgramOptions): Promise<string> {
  const yarnPath = path.join(options.globalStoragePath, 'yarn.js');
  const process = await spawn({
    args: [yarnPath, 'bin', options.dependency],
    cwd: options.globalStoragePath,
    cacheLog: true,
  });
  return new Promise((resolve, reject) => {
    process.once('error', (err) => reject(err));
    process.once('exit', async (code) => {
      // There seem to be intermittent times where `exit` is handled before `data`,
      // meaning the output of this command will not yet have been recorded by the
      // time this event was fired. Push this handler to the back of the async queue.
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (code && code !== 0) {
        const message = [
          `failed to fetch bin path for ${options.dependency}`,
          process.log.toString(),
        ].join('\n');
        throw new Error(message);
      }

      const result = process.log
        .filter((l) => l.stream === OutputStream.Stdout)
        .map((l) => l.data)
        .join('\n');
      resolve(result);
    });
  });
}

export function spawn(options: SpawnOptions): ChildProcess {
  const nodePath: string = process.argv0;
  const additionalEnv: NodeJS.ProcessEnv = process.env;
  const additionalArgs: string[] = [];
  const isElectronApp = !vscode.env.remoteName;

  if (isElectronApp) {
    additionalEnv['ELECTRON_RUN_AS_NODE'] = 'true';
    additionalArgs.push('--ms-enable-electron-run-as-node');
  }

  if (options.binPath) {
    additionalArgs.push(options.binPath);
  }

  const args = [...additionalArgs, ...(options.args || [])];
  const env = { ...process.env, ...additionalEnv, ...(options.env || {}) };
  const newProcess = childProcess.spawn(nodePath, args, { ...options, env });
  const loggedProcess = ProcessLog.appendLogger(newProcess, options.log, options.cacheLog);

  return loggedProcess;
}
