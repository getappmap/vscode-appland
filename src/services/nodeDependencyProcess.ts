import * as childProcess from 'child_process';
import * as vscode from 'vscode';
import * as path from 'path';
import { readFile } from 'fs/promises';
import ExtensionSettings from '../configuration/extensionSettings';

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
  saveOutput?: boolean;
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
    protected saveOutput?: boolean
  ) {
    super();
  }

  static appendLogger(
    process: childProcess.ChildProcessWithoutNullStreams,
    outputChannel?: vscode.OutputChannel,
    save?: boolean
  ): ChildProcess {
    if ((process as ChildProcess).log) {
      throw new Error(`process ${process.pid} already has a logger appended`);
    }

    const log = new ProcessLog(process, outputChannel, save);

    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');
    process.stdout.on('data', (data) => log.append(data, OutputStream.Stdout, true));
    process.stderr.on('data', (data) => log.append(data, OutputStream.Stderr, true));
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

  append(data: string, stream = OutputStream.Stdout, save = false): void {
    if (this.saveOutput && save) {
      this.push({ stream, data });
    }

    if (this.outputChannel) {
      const { outputChannel } = this;
      data
        .trimEnd()
        .split('\n')
        .forEach((line) => {
          outputChannel.appendLine(`${this.process?.pid} [${OutputStream[stream]}] ${line}`);
        });
    }
  }

  toString(): string {
    return this.map((log) => `${log.stream}: ${log.data}`).join('\n');
  }
}

export async function getBinPath(options: ProgramOptions): Promise<string> {
  const overridePath = ExtensionSettings.appMapCommandLineToolsPath;
  if (overridePath) return overridePath;

  const base = path.join(options.globalStoragePath, 'node_modules', '@appland', options.dependency);
  const bin = JSON.parse(await readFile(path.join(base, 'package.json'), 'utf8')).bin;
  return path.join(base, bin);
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
  const loggedProcess = ProcessLog.appendLogger(newProcess, options.log, options.saveOutput);

  return loggedProcess;
}

export async function verifyCommandOutput(
  cmd: childProcess.ChildProcessWithoutNullStreams
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    cmd.once('error', (err) => {
      reject(new Error(String(err)));
    });
    cmd.once('exit', (code, signal) => {
      if (signal) {
        return reject(new Error(`${cmd.spawnargs.join(' ')} exited due to ${signal}`));
      } else if (code !== undefined && code !== 0) {
        return reject(new Error(`${cmd.spawnargs.join(' ')} exited with code ${code}`));
      }
      resolve();
    });
  });
}
