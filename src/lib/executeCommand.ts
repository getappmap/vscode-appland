import { exec } from 'child_process';
import { log } from 'console';

export function executeCommand(cmd: string, logCommand = true): Promise<string> {
  if (logCommand) console.log(cmd);
  const command = exec(cmd);
  const result: string[] = [];
  const stderr: string[] = [];
  if (command.stdout) {
    command.stdout.addListener('data', (data) => {
      result.push(data);
    });
  }
  if (command.stderr) {
    command.stderr.addListener('data', (data) => {
      stderr.push(data);
    });
  }
  return new Promise<string>((resolve, reject) => {
    command.addListener('exit', (code, signal) => {
      if (signal || code === 0) {
        if (signal) log(`Command killed by signal ${signal}`);
        resolve(result.join(''));
      } else {
        if (!logCommand) log(cmd);
        log(stderr.join(''));
        log(result.join(''));

        reject(new Error(`Command failed with code ${code}`));
      }
    });
  });
}
