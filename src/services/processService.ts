import * as vscode from 'vscode';
import { ChildProcess, spawn, SpawnOptions } from 'child_process';
import commandArgs, { Command } from './commandArgs';

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
    const command = await commandArgs(this.folder, args, options);
    this.invokeCommand(command);
  }

  protected async invokeCommand(command: Command, timeout = 10000): Promise<void> {
    this.process = spawn(command.mainCommand, command.args, command.options);
    ProcessService.logProcess(this.process, true);
    this.process.once('exit', (code) => {
      if (this.retry) {
        vscode.window.showErrorMessage(
          `${this.process?.spawnargs.join(' ')} exited with code ${code}`
        );

        // Restart
        setTimeout(() => this.invokeCommand(command, timeout * 1.5), timeout);
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
<<<<<<< HEAD

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
=======
>>>>>>> 1d4c803 (refactor: Refactor ProcessService)
