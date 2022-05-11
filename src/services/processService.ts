import { ChildProcess, spawn, SpawnOptions } from 'child_process';

export default class ProcessService {
  process?: ChildProcess;
  retry = true;

  constructor(public dir: string) {}

  dispose(): void {
    if (!this.process) return;

    this.process.kill();
    this.retry = false;
    this.process = undefined;
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
        console.warn(`${this.process?.spawnargs.join(' ')} exited with code ${code}`);

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
