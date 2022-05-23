import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import Command from './command';
import { assert } from 'console';
import EventEmitter from 'events';

export default class ProcessService extends EventEmitter {
  process?: ChildProcess;
  retry = true;

  constructor(public folder: vscode.WorkspaceFolder, public setting: () => string | string[]) {
    super();
  }

  async dispose(): Promise<number | undefined> {
    if (!this.process) return;

    this.retry = false;
    this.process.kill();
    const process = this.process;
    this.process = undefined;
    return new Promise<number>((resolve) => process.once('exit', resolve));
  }

  async start(): Promise<void> {
    const commandSetting = this.setting();
    let command: Command;
    if (typeof commandSetting === 'string') {
      const commandArgs = commandSetting.split(' ');
      const mainCommand = commandArgs.shift();
      assert(mainCommand);
      command = new Command(mainCommand as string, commandArgs, {});
    } else {
      command = await Command.commandArgs(this.folder, commandSetting, {});
    }

    return this.invokeCommand(command);
  }

  protected async invokeCommand(command: Command, timeout = 10000): Promise<void> {
    this.emit('invoke', command);
    this.process = spawn(command.mainCommand, command.args, command.options);

    ProcessService.logProcess(this.process, this);

    this.process.once('exit', (code) => {
      this.emit('exit', code);

      if (this.retry) {
        vscode.window.showErrorMessage(
          `${this.process?.spawnargs.join(' ')} exited with code ${code}`
        );

        // Restart
        setTimeout(() => this.invokeCommand(command, timeout * 1.5), timeout);
      }
    });
  }

  protected static logProcess(child: ChildProcess, eventEmitter: EventEmitter): void {
    child.once('exit', (code) => {
      eventEmitter.emit('exit', code);
      console.log(code);
    });
    child.once('error', (err) => console.warn(err));

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (data) => {
        const msg = `[stdout] ${child.spawnargs.join(' ')}: ${data}`;
        eventEmitter.emit('message', msg);
        console.log(msg);
      });
    }

    if (child.stderr) {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (data) => {
        const msg = `[stderr] ${child.spawnargs.join(' ')}: ${data}`;
        eventEmitter.emit('message', msg);
        console.log(msg);
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
