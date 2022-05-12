import * as vscode from 'vscode';
import { exec } from 'child_process';
import { close, open, utimes } from 'fs';
import { join } from 'path';

export const FixtureDir = join(
  __dirname,
  '../../../test/fixtures/workspaces/project-with-findings'
);

export async function initializeWorkspace(): Promise<void> {
  await closeAllEditors();
  await cleanWorkspace();
}

async function closeAllEditors(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.closeAllEditors');
}

async function executeWorkspaceOSCommand(cmd: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, { cwd: FixtureDir }, (err, stdout, stderr) => {
      if (err) {
        console.log(stdout);
        console.warn(stderr);
        return reject(err);
      }
      resolve();
    });
  });
}

async function cleanWorkspace(): Promise<void> {
  await executeWorkspaceOSCommand(`git clean -fd .`);
  await executeWorkspaceOSCommand(`git restore .`);
}

export async function waitFor(
  message: string,
  test: () => boolean | Promise<boolean>,
  timeout = 10000
): Promise<void> {
  const startTime = Date.now();
  let delay = 250;
  while (!(await test())) {
    const elapsed = Date.now() - startTime;
    if (elapsed > timeout) {
      throw new Error(message);
    }

    delay = delay * 1.5;
    await wait(delay);
  }
}

export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function touch(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const time = new Date();
    utimes(path, time, time, (err) => {
      if (err) {
        return open(path, 'w', (err, fd) => {
          if (err) return reject(err);
          close(fd, (err) => (err ? reject(err) : resolve()));
        });
      }
      resolve();
    });
  });
}
