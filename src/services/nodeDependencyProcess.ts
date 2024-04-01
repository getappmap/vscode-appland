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
  // Path to a node module script to be executed
  modulePath?: string;

  // Path to a binary file to be executed
  binPath: string;

  // Command line args given to `node` or the `bin` script specified
  args?: string[];

  // If specified, write log messages to the given output channel
  log?: vscode.OutputChannel;

  // Indicates whether or not log messages should be retained in a buffer
  saveOutput?: boolean;

  // If specified, this function will be called with each line of stdout
  stdoutListener?: (data: string) => void;
} & Exclude<childProcess.SpawnOptionsWithoutStdio, 'argv0'>;

export enum OutputStream {
  Stdout,
  Stderr,
}

export type ProcessLogItem = { stream: OutputStream; data: string };
export class ProcessLog extends Array<ProcessLogItem> {
  protected constructor(
    protected process: childProcess.ChildProcessWithoutNullStreams,
    protected outputChannel?: vscode.OutputChannel,
    saveOutput?: boolean
  ) {
    super();
    if (saveOutput) this.maxLength = 1024 * 1024; // aka. infinity
  }

  // number of messages to keep
  private maxLength = 16;

  static appendLogger(
    process: childProcess.ChildProcessWithoutNullStreams,
    outputChannel?: vscode.OutputChannel,
    save?: boolean,
    dataListener?: (data: string) => void
  ): ChildProcess {
    if ((process as ChildProcess).log) {
      throw new Error(`process ${process.pid} already has a logger appended`);
    }

    const log = new ProcessLog(process, outputChannel, save);

    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');
    process.stdout.on('data', (data) => {
      if (dataListener) dataListener(data);
      log.append(data, OutputStream.Stdout, true);
    });
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
    if (save) this.push({ stream, data });
    if (this.length > this.maxLength) this.shift();

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
    return this.map((log) => `${OutputStream[log.stream]}: ${log.data}`).join('\n');
  }
}

export function getModulePath(dependency: ProgramName): string | undefined {
  const localToolsPath = ExtensionSettings.appMapCommandLineToolsPath;
  if (localToolsPath) {
    let packageName: string;
    switch (dependency) {
      case ProgramName.Appmap:
        packageName = 'cli';
        break;
      case ProgramName.Scanner:
        packageName = 'scanner';
        break;
    }
    const bin = 'built/cli.js';
    return path.join(localToolsPath, 'packages', packageName, bin);
  }
}

export function spawn(options: SpawnOptions): ChildProcess {
  const env = { ...process.env, ...(options.env || {}) };
  let newProcess: childProcess.ChildProcess;
  if (options.modulePath) {
    newProcess = childProcess.fork(options.modulePath, options.args || [], {
      ...options,
      env,
      execArgv: [],
      stdio: 'pipe',
    });
  } else if (options.binPath) {
    newProcess = childProcess.spawn(options.binPath, options.args || [], {
      ...options,
      env,
      stdio: 'pipe',
    });
  } else {
    // The type checker should prevent this case
    throw new Error('SpawnOptions not runnable');
  }

  const loggedProcess = ProcessLog.appendLogger(
    newProcess as childProcess.ChildProcessWithoutNullStreams,
    options.log,
    options.saveOutput,
    options.stdoutListener
  );

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
