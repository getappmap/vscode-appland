import { spawn } from 'child_process';
import * as vscode from 'vscode';

export enum ProcessOutputType {
  Stdout,
  Stderr,
}

export type ProcessOutputLog = { type: ProcessOutputType; data: string }[];

export type ProcessOutput = {
  log: Readonly<ProcessOutputLog>;
  exitCode?: number;
  signal?: NodeJS.Signals;
};

export default class NodeRunner {
  protected nodePath: string = process.argv[0];
  protected additionalEnv: NodeJS.ProcessEnv = process.env;
  protected additionalArgs: string[] = ['--experimental-modules'];

  constructor(protected readonly cwd?: string) {
    const isElectronApp = !vscode.env.remoteName;
    if (isElectronApp) {
      this.additionalEnv['ELECTRON_RUN_AS_NODE'] = 'true';
      this.additionalArgs.push('--ms-enable-electron-run-as-node');
    }
  }

  async exec(...args: string[]): Promise<ProcessOutput> {
    const processArgs = [...this.additionalArgs, ...args];
    const env = { ...process.env, ...this.additionalEnv };
    const childProcess = spawn(this.nodePath, processArgs, { env, cwd: this.cwd });
    const log: ProcessOutputLog = [];
    return new Promise((resolve, reject) => {
      childProcess.stdout.setEncoding('utf8');
      childProcess.stderr.setEncoding('utf8');
      childProcess.stdout.on('data', (data) => log.push({ type: ProcessOutputType.Stdout, data }));
      childProcess.stderr.on('data', (data) => log.push({ type: ProcessOutputType.Stderr, data }));
      childProcess.once('error', (err) => reject(err));
      childProcess.once('exit', (code, signal) =>
        resolve({ log, exitCode: code || undefined, signal: signal || undefined })
      );
    });
  }
}
