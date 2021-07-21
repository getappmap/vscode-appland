import * as fs from 'fs';
import {
  ChildProcess,
  exec as processExec,
  execFile as processExecFile,
  ExecFileOptions,
  ExecOptions as ProcessExecOptions,
} from 'child_process';
import * as vscode from 'vscode';
import Terminal, { TerminalResult } from './terminal';

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

interface ExecOptions {
  encoding?: string | null;
  output?: boolean | null;
  userCanTerminate?: boolean | null;
  progressMessage?: string | null;
}

async function handleExecChildProcess(
  childProcess: ChildProcess,
  options?: ExecOptions | null,
  onCreateOutput?: (outputChannel: vscode.OutputChannel) => void
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const promise: Promise<{ exitCode: number; stdout: string; stderr: string }> = new Promise(
    (resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let outputChannel: vscode.OutputChannel | undefined;

      if (options?.output) {
        outputChannel = vscode.window.createOutputChannel('AppMap');
        outputChannel.show();

        if (onCreateOutput) {
          onCreateOutput(outputChannel);
        }
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
    }
  );

  if (options?.userCanTerminate) {
    vscode.window.withProgress(
      {
        cancellable: true,
        location: vscode.ProgressLocation.Notification,
        title: 'AppMap',
      },
      async (progress, token) => {
        if (options.progressMessage) {
          progress.report({ message: options.progressMessage });
        }

        token.onCancellationRequested(() => {
          childProcess.kill('SIGTERM');
        });

        return promise;
      }
    );
  }

  return promise;
}

/**
 * Exec a process
 * If options.output is true, the stdout/stderr will be written to the output window.
 */
export async function execFile(
  file: string,
  args?: ReadonlyArray<string> | null,
  options?: (ExecOptions & ExecFileOptions) | undefined | null
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const childProcess = processExecFile(file, args, options);
  return await handleExecChildProcess(childProcess, options, (output) => {
    output.append(`Executing: ${file} ${args?.join(' ')}\n`);

    if (options?.env) {
      output.append(`Environment: ${JSON.stringify(options.env, null, 2)}\n\n`);
    }

    output.append('\n');
  });
}

/**
 * Exec a command in terminal
 */
export async function execCommand(
  path: fs.PathLike,
  program: string,
  args?: ReadonlyArray<string> | null,
  environment?: ReadonlyArray<string> | null,
  terminalName?: string | null
): Promise<TerminalResult> {
  const cmd =
    program + ' ' + (environment ? environment.join(' ') : '') + (args ? args.join(' ') : '');

  const terminal = new Terminal(path, terminalName as string);
  return terminal.run(cmd);
}

/**
 * Exec a process
 * If options.output is true, the stdout/stderr will be written to the output window.
 */
export async function exec(
  command: string,
  options?: (ExecOptions & ProcessExecOptions) | undefined | null
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const childProcess = processExec(command, options);
  return await handleExecChildProcess(childProcess, options, (output) => {
    output.append(`Executing: ${command}\n\n`);
  });
}

export function unreachable(msg: string | undefined): never {
  throw new Error(`Unreachable: ${msg}`);
}

export function workspaceFolderForDocument(
  document: vscode.TextDocument
): vscode.WorkspaceFolder | undefined {
  const { workspaceFolders } = vscode.workspace;
  if (!workspaceFolders) {
    return undefined;
  }

  let bestMatch;
  let bestMatchLength = 0;
  workspaceFolders.forEach((workspaceFolder) => {
    const { length } = workspaceFolder.name;
    if (bestMatchLength > length) {
      // The best match matches more characters than this directory has available.
      // This folder will never be a best match. Skip.
      return;
    }

    if (document.uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
      bestMatch = workspaceFolder;
      bestMatchLength = length;
    }
  });

  return bestMatch;
}

const WORKSPACE_OPENED_APPMAP_KEY = 'appmap.applandinc.workspaces_opened_appmap';
export function hasWorkspaceFolderOpenedAppMap(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder
): boolean {
  const appmapsOpen = new Set<string>(context.globalState.get(WORKSPACE_OPENED_APPMAP_KEY) || []);
  return appmapsOpen.has(workspaceFolder.uri.fsPath);
}

export function flagWorkspaceOpenedAppMap(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder
): void {
  const appmapsOpen = new Set<string>(context.globalState.get(WORKSPACE_OPENED_APPMAP_KEY) || []);
  appmapsOpen.add(workspaceFolder.uri.fsPath);
  context.globalState.update(WORKSPACE_OPENED_APPMAP_KEY, [...appmapsOpen]);
}

const WORKSPACE_RECORDED_APPMAP_KEY = 'appmap.applandinc.workspace_recorded_appmap';
export function hasWorkspaceFolderRecordedAppMap(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder
): boolean {
  const appmapsOpen = new Set<string>(context.globalState.get(WORKSPACE_RECORDED_APPMAP_KEY) || []);
  return appmapsOpen.has(workspaceFolder.uri.fsPath);
}

export function flagWorkspaceRecordedAppMap(
  context: vscode.ExtensionContext,
  workspaceFolder: vscode.WorkspaceFolder
): void {
  const appmapsOpen = new Set<string>(context.globalState.get(WORKSPACE_RECORDED_APPMAP_KEY) || []);
  appmapsOpen.add(workspaceFolder.uri.fsPath);
  context.globalState.update(WORKSPACE_RECORDED_APPMAP_KEY, [...appmapsOpen]);
}

// Resolve promises serially, one at a time.
export async function chainPromises(
  onResolve: (unknown) => void,
  ...promises: Promise<unknown>[]
): Promise<unknown> {
  const promise = promises.shift();
  if (promise) {
    onResolve(await promise);
    return chainPromises(onResolve, ...promises);
  }
}

export const QUICKSTART_SEEN = 'QUICKSTART_SEEN';

export function getQuickstartSeen(context: vscode.ExtensionContext): boolean {
  const seen = context.globalState.get(QUICKSTART_SEEN) == true;
  return seen;
}

export function setQuickstartSeen(context: vscode.ExtensionContext, seen: boolean): void {
  context.globalState.update(QUICKSTART_SEEN, seen);
}
