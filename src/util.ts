import * as fs from 'fs';
import { execFile, ExecFileOptions } from 'child_process';
import * as vscode from 'vscode';
import { rejects } from 'assert';

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// Returns an object's string values with an optional key prefix
// getStringRecords({ a: 'hello', b: [object Object] }, 'myApp') ->
// { 'myApp.a': 'hello' }
export function getStringRecords(
  obj: Record<string, unknown>,
  keyPrefix?: string
): Record<string, string> {
  const base = keyPrefix ? `${keyPrefix}.` : '';

  return Object.entries(obj).reduce((memo, [k, v]) => {
    if (typeof v !== 'object') {
      memo[`${base}${k}`] = String(v);
    }
    return memo;
  }, {} as Record<string, string>);
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

export function isFileExists(filename: string): boolean {
  try {
    fs.accessSync(filename, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Exec a process
 * If options.output is true, the stdout/stderr will be written to the output window.
 */
export async function exec(
  file: string,
  args: ReadonlyArray<string> | null | undefined,
  options?:
    | ({ encoding?: string | null; output?: boolean | null } & ExecFileOptions)
    | undefined
    | null
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const childProcess = execFile(file, args, options);
    let stdout = '';
    let stderr = '';
    let outputChannel: vscode.OutputChannel | undefined;

    if (options?.output) {
      outputChannel = vscode.window.createOutputChannel('AppMap');
    }

    childProcess.stdout?.on('data', (data) => {
      outputChannel?.append(data);
      stdout += data;
    });

    childProcess.stderr?.on('data', (data) => {
      outputChannel?.append(data);
      stderr += data;
    });

    childProcess.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });

    childProcess.on('error', (e) => {
      reject(e);
    });
  });
}
