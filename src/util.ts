import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import {
  ChildProcess,
  exec as processExec,
  execFile as processExecFile,
  ExecFileOptions,
  ExecOptions as ProcessExecOptions,
} from 'child_process';
import * as vscode from 'vscode';
import { ProjectStateServiceInstance } from './services/projectStateService';

const REDIRECT_STATUS_CODES = [301, 302, 307, 308];

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
export function getRecords<T>(obj: Record<string, unknown>, keyPrefix?: string): Record<string, T> {
  if (!obj) return {};

  const base = keyPrefix ? `${keyPrefix}.` : '';

  return Object.entries(obj).reduce((memo, [k, v]) => {
    if (typeof v !== 'object') {
      memo[`${base}${k}`] = v as T;
    }
    return memo;
  }, {} as Record<string, T>);
}

export function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}

// It would be weird to have a mono-repo whose sub-projects are nested more deeply than this.
const MAX_DIR_SEARCH = 3;

export async function resolveFilePath(
  basePath: string,
  filePath: string
): Promise<string | undefined> {
  // If the file is part of a monorepo (project directory with sub-projects), then the first
  // entry(s) of the AppMap path may be the path to the project directory. So, search up a reasonable
  // number of directory levels to try and resolve the AppMap path.

  const pathsToSearch: string[] = [];
  if (path.isAbsolute(filePath)) {
    pathsToSearch.push(filePath);
  } else {
    const basePathTokens = basePath.split(path.sep);
    for (let pathIndex = 0; pathIndex < MAX_DIR_SEARCH; pathIndex++) {
      const basePathSub = basePathTokens.slice(0, basePathTokens.length - pathIndex).join(path.sep);
      if (basePathSub === process.env.HOME) break;

      pathsToSearch.push(path.join(basePathSub, filePath));
    }
  }

  for (const pathToSearch of pathsToSearch) {
    if (await fileExists(pathToSearch)) {
      return pathToSearch;
    }
  }
}

export async function fileExists(filename: string): Promise<boolean> {
  return new Promise((resolve) => fs.access(filename, (err) => resolve(err === null)));
}

export async function retry(
  fn: () => void | Promise<void>,
  retries = 3,
  interval = 100
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    if (retries === 0) {
      throw e;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
    await retry(fn, retries - 1, interval);
  }
}

interface ExecOptions {
  output?: boolean | null;
  userCanTerminate?: boolean | null;
  progressMessage?: string | null;
}

function removeExecOptions<T extends ExecOptions>(
  options?: T | null
): Exclude<T, ExecOptions> | undefined | null {
  if (!options) return options;
  const result = { ...options };
  delete result.output;
  delete result.userCanTerminate;
  delete result.progressMessage;
  return result as Exclude<T, ExecOptions>;
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
        if (!exitCode) reject(`child process ${childProcess.spawnfile} failed`);
        else resolve({ exitCode, stdout, stderr });
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
  const childProcess = processExecFile(file, args, removeExecOptions(options));
  return await handleExecChildProcess(childProcess, options, (output) => {
    output.append(`Executing: ${file} ${args?.join(' ')}\n`);

    if (options?.env) {
      output.append(`Environment: ${JSON.stringify(options.env, null, 2)}\n\n`);
    }

    output.append('\n');
  });
}

/**
 * Exec a process
 * If options.output is true, the stdout/stderr will be written to the output window.
 */
export async function exec(
  command: string,
  options?: (ExecOptions & ProcessExecOptions) | undefined | null
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const childProcess = processExec(command, removeExecOptions(options));
  return await handleExecChildProcess(childProcess, options, (output) => {
    output.append(`Executing: ${command}\n\n`);
  });
}

export function unreachable(msg: string | undefined): never {
  throw new Error(`Unreachable: ${msg}`);
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

/** Iterate over extension directories to find another AppMap extension. Presence of another installation would
 * indicate that this is not a new user.
 */
export function hasPreviouslyInstalledExtension(extensionPath: string): boolean {
  const extensionDirectories = [
    ...new Set(
      vscode.extensions.all.map((extension) => path.dirname(extension.extensionUri.fsPath))
    ),
  ];

  const extensionName = path.basename(extensionPath);
  for (let i = 0; i < extensionDirectories.length; i++) {
    const dir = extensionDirectories[i];
    let ents: fs.Dirent[] = [];
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      continue;
    }

    for (let k = 0; k < ents.length; ++k) {
      const ent = ents[k];
      if (
        ent.isDirectory() &&
        ent.name.startsWith('appland.appmap') &&
        ent.name !== extensionName
      ) {
        return true;
      }
    }
  }

  return false;
}

export async function getWorkspaceFolderFromPath(
  projectStates: ProjectStateServiceInstance[],
  path: string
): Promise<vscode.WorkspaceFolder | undefined> {
  // generate an array of promises that resolve to a project path
  const promises = projectStates.map(async (projectState) => {
    const metadata = await projectState.metadata();
    return metadata?.path;
  });

  // convert the array of promises to an array of project paths
  const projectPaths = await Promise.all(promises);

  const projectIndex = projectPaths.findIndex((projectPath) => {
    return path.includes(projectPath);
  });

  return projectStates[projectIndex]?.folder;
}

export function shellescape(...command: string[]): string {
  const result: string[] = [];

  command.forEach(function(word) {
    if (/[^A-Za-z0-9_/:=-]/.test(word)) {
      word = "'" + word.replace(/'/g, "'\\''") + "'";
      word = word
        .replace(/^(?:'')+/g, '') // unduplicate single-quote at the beginning
        .replace(/\\'''/g, "\\'"); // remove non-escaped single-quote if there are enclosed between 2 escaped
    }
    result.push(word);
  });

  return result.join(' ');
}

// Convert a union type to an intersection type. Don't use this on boolean types.
// e.g. ( string | number ) => ( string & number )
// See https://stackoverflow.com/a/50375286
export type UnionToIntersection<U> = (U extends unknown
? (k: U) => U
: never) extends (k: infer I) => void
  ? I
  : never;

export function downloadFile(url: string, destination: fs.WriteStream): Promise<boolean> {
  return new Promise((resolve) => {
    https
      .get(url, async (response) => {
        const statusCode = response.statusCode || NaN;

        if (REDIRECT_STATUS_CODES.includes(statusCode)) {
          const redirectUrl = response.headers?.location;

          if (redirectUrl) {
            resolve(await downloadFile(redirectUrl, destination));
          }
          resolve(false);
        } else {
          response.pipe(destination);

          destination.on('finish', () => {
            resolve(true);
          });
        }
      })
      .on('error', () => resolve(false));
  });
}

export function getLatestVersionInfo(appmapPackage: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/@appland%2F${appmapPackage}/latest`, (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          resolve(JSON.parse(body));
        });
      })
      .on('error', (err) => reject(err));
  });
}
