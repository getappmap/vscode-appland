import * as vscode from 'vscode';
import { ChildProcess, spawn, SpawnOptions } from 'child_process';

export default class ProcessService {
  process?: ChildProcess;
  retry = true;

  constructor(public dir: string) {}

  async dispose(): Promise<number | undefined> {
    if (!this.process) return;

    this.retry = false;
    this.process.kill();
    const process = this.process;
    this.process = undefined;
    return new Promise<number>((resolve) => process.once('exit', resolve));
  }

  protected runProcess(
    command: string,
    args: string[],
    options: SpawnOptions,
    timeout = 3000
  ): void {
    this.process = spawn(command, args, options);

    ProcessService.logProcess(this.process, true);

    this.process.once('exit', (code) => {
      if (this.retry) {
        vscode.window.showErrorMessage(
          `${this.process?.spawnargs.join(' ')} exited with code ${code}`
        );

        // Restart
        setTimeout(() => this.runProcess(command, args, options, timeout * 1.5), timeout);
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
