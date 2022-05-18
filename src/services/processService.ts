import * as vscode from 'vscode';
import { ChildProcess, exec, spawn, SpawnOptions } from 'child_process';
import { resolveFilePath } from '../util';
import { promisify } from 'util';
import { readFile } from 'fs';
import { packageManagerCommand } from '../configuration/packageManager';

export default class ProcessService {
  process?: ChildProcess;
  retry = true;

  constructor(public folder: vscode.WorkspaceFolder) {}

  async dispose(): Promise<number | undefined> {
    if (!this.process) return;

    this.retry = false;
    this.process.kill();
    const process = this.process;
    this.process = undefined;
    return new Promise<number>((resolve) => process.once('exit', resolve));
  }

  protected async runProcess(args: string[], options: SpawnOptions): Promise<void> {
    const home = process.env.HOME || '';
    let error: string | undefined;
    const environment: Record<string, string> = {};

    (await packageManagerCommand(this.folder.uri)).reverse().forEach((cmd) => args.unshift(cmd));

    const nvmrcPath = await resolveFilePath(this.folder.uri.fsPath, '.nvmrc');
    if (nvmrcPath) {
      args.unshift([home, '.nvm/nvm-exec'].join('/'));
      const version = (await promisify(readFile)(nvmrcPath)).toString().trim();
      environment.NODE_VERSION = version;
      error = validateNodeVersion('nvm', version);
    } else {
      const availableVersion = await systemNodeVersion();
      if (availableVersion instanceof Error) {
        error = `Node.js is not installed`;
      } else {
        error = validateNodeVersion('System', availableVersion);
      }
    }
    if (error) {
      vscode.window.showWarningMessage(error);
    }
    if (process.env.SHELL) {
      options.shell = process.env.SHELL;
    }

    options.env = { ...process.env, ...environment };
    options.cwd = this.folder.uri.fsPath;
    options.detached = false;

    const mainCommand = args.shift();
    if (!mainCommand) throw new Error('No command provided');

    this.invokeCommand(mainCommand, args, options);
  }

  protected invokeCommand(
    mainCommand: string,
    args: string[],
    options: SpawnOptions,
    timeout = 3000
  ): void {
    this.process = spawn(mainCommand, args, options);

    ProcessService.logProcess(this.process, true);

    this.process.once('exit', (code) => {
      if (this.retry) {
        vscode.window.showErrorMessage(
          `${this.process?.spawnargs.join(' ')} exited with code ${code}`
        );

        // Restart
        setTimeout(() => this.invokeCommand(mainCommand, args, options, timeout * 1.5), timeout);
      }
    });
  }

  static logProcess(child: ChildProcess, debug: boolean): void {
    child.once('exit', (code) => console.log(code));
    child.once('error', (err) => console.warn(err));

    if (debug && child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (data) => {
        console.log(`[stdout] ${child.spawnargs.join(' ')}: ${data}`);
      });
    }

    if (debug && child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (data) => {
        console.log(`[stderr] ${child.spawnargs.join(' ')}: ${data}`);
      });
    }
  }
}

function validateNodeVersion(versionType: string, version: string): string | undefined {
  const digits = version.split('.');
  if (digits.length === 0) {
    return `Version string is empty`;
  }

  const majorVersion = parseInt(digits[0].replace(/[^0-9]/g, ''), 10);
  if (majorVersion % 2 === 0 && majorVersion >= 14) {
    return;
  }

  return `${versionType} Node.js version ${version} should be an even major version number >= 14`;
}

async function systemNodeVersion(): Promise<string | Error> {
  return new Promise((resolve) => {
    exec('node -v', { shell: vscode.env.shell }, (err, stdout) => {
      if (err) {
        resolve(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
