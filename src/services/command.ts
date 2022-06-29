import * as vscode from 'vscode';
import { resolveFilePath } from '../util';
import { promisify } from 'util';
import { readFile } from 'fs';
import { packageManagerCommand } from '../configuration/packageManager';
import { exec, SpawnOptions } from 'child_process';
import { delimiter, resolve } from 'path';

export default class Command {
  constructor(public mainCommand: string, public args: string[], public options: SpawnOptions) {}

  static async commandArgs(
    folder: vscode.WorkspaceFolder,
    args: string[],
    options: SpawnOptions
  ): Promise<Command> {
    const home = process.env.HOME || '';
    let error: string | undefined;
    const environment: Record<string, string> = {};

    (await packageManagerCommand(folder.uri)).reverse().forEach((cmd) => args.unshift(cmd));

    const nvmVersion = await nvmNodeVersion(folder);
    if (nvmVersion) {
      args.unshift([home, '.nvm/nvm-exec'].join('/'));
      environment.NODE_VERSION = nvmVersion;
      error = validateNodeVersion('nvm', nvmVersion);
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

    let yarnDir: string | undefined;
    if (process.env.HOME && (yarnDir = await resolveFilePath(process.env.HOME, '.yarn'))) {
      environment.PATH = [resolve(yarnDir, 'bin'), process.env.PATH].join(delimiter);
    }

    options.cwd = folder.uri.fsPath;
    options.env = { ...process.env, ...environment };
    options.detached = false;

    const mainCommand = args.shift();
    if (!mainCommand) throw new Error('No command provided');

    return {
      mainCommand,
      args: args.map((arg) => (arg === '${workspaceFolder}' ? folder.uri.fsPath : arg)),
      options,
    };
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

export async function systemNodeVersion(): Promise<string | Error> {
  return new Promise((resolve) => {
    exec('node -v', (err, stdout) => {
      if (err) {
        resolve(err);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

export async function nvmNodeVersion(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
  const nvmrcPath = await resolveFilePath(folder.uri.fsPath, '.nvmrc');
  if (nvmrcPath) {
    return (await promisify(readFile)(nvmrcPath)).toString().trim();
  }
  return undefined;
}
