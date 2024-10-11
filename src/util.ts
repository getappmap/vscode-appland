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
import Environment from './configuration/environment';

const REDIRECT_STATUS_CODES = [301, 302, 307, 308];

// Returns an object's string values with an optional key prefix
// getStringRecords({ a: 'hello', b: [object Object] }, 'myApp') ->
// { 'myApp.a': 'hello' }
export function getRecords<T>(
  obj?: Record<string, unknown>,
  keyPrefix?: string,
  transformer = (x: unknown) => x as T
): Record<string, T> {
  if (!obj) return {};

  return Object.entries(obj)
    .filter(([, v]) => v !== null && v !== undefined)
    .reduce((memo, [k, v]) => {
      const key = [keyPrefix, k].filter(Boolean).join('.');
      if (typeof v === 'object') {
        memo = {
          ...memo,
          ...getRecords(v as Record<string, unknown>, key, transformer),
        };
      } else {
        if (v) memo[key] = transformer(v);
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
    console.warn(`Retrying after error: ${e}`);
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
  if (Environment.isDevelopmentExtension) return false;

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

export function getWorkspaceFolderFromPath(path: string): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(vscode.Uri.file(path));
}

export function shellescape(...command: string[]): string {
  const result: string[] = [];

  command.forEach(function (word) {
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
export type UnionToIntersection<U> = (U extends unknown ? (k: U) => U : never) extends (
  k: infer I
) => void
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

interface VersionInfo {
  version: string;
}

function isVersionInfo(info: unknown): info is VersionInfo {
  return !!info && typeof info === 'object' && typeof info['version'] === 'string';
}

export function getLatestVersionInfo(appmapPackage: string): Promise<VersionInfo> {
  return new Promise((resolve, reject) => {
    https
      .get(`https://registry.npmjs.org/@appland%2F${appmapPackage}/latest`, (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          const result = JSON.parse(body) as unknown;
          if (isVersionInfo(result)) resolve(result);
          else reject(new Error('malformed response from npmjs'));
        });
      })
      .on('error', (err) => reject(err));
  });
}

type Epoch = { name: string; seconds: number };

const EPOCHS: Epoch[] = [
  { name: 'year', seconds: 31536000 },
  { name: 'month', seconds: 2592000 },
  { name: 'day', seconds: 86400 },
  { name: 'hour', seconds: 3600 },
  { name: 'minute', seconds: 60 },
  { name: 'second', seconds: 1 },
];

const getDuration = (timeAgoInSeconds: number): { interval: number; epoch: string } => {
  for (const { name, seconds } of EPOCHS) {
    const interval = Math.floor(timeAgoInSeconds / seconds);
    if (interval >= 1) {
      return {
        interval: interval,
        epoch: name,
      };
    }
  }
  return { epoch: 'second', interval: 0 };
};

export function timeAgo(compareFrom: number, compareTo: number): string {
  const timeAgoInSeconds = Math.floor((compareTo - compareFrom) / 1000);
  const { interval, epoch } = getDuration(timeAgoInSeconds);
  const suffix = interval === 1 ? '' : 's';
  return `${interval} ${epoch}${suffix} ago`;
}

export function sanitizeEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  const sanitizedEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env || {})) {
    if (!v) continue;

    sanitizedEnv[k] = k.match(/_KEY$/) ? '***' : v;
  }
  return sanitizedEnv;
}

export async function parseLocation(
  location: string,
  directory?: string
): Promise<vscode.Location | vscode.Uri> {
  const match = location.match(/:(\d+(-\d+)?)$/);
  if (match) {
    let locationPath = location.substring(0, match.index);
    if (!path.isAbsolute(locationPath)) {
      let workspaceFolder: vscode.WorkspaceFolder | undefined;
      if (directory) {
        workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(directory));
      }

      const pattern = workspaceFolder
        ? new vscode.RelativePattern(workspaceFolder, `**/${locationPath}`)
        : `**/${locationPath}`;
      const files = await vscode.workspace.findFiles(pattern);
      if (files.length > 0) {
        locationPath = files[0].fsPath;
      }
    }

    const [startLine, endLine] = match[1].split('-').map((x) => parseInt(x, 10) - 1);
    return new vscode.Location(
      vscode.Uri.file(locationPath),
      new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine ?? startLine, 0)
      )
    );
  }
  // Remove any file:// prefix from the URI. Uri.file() will add it back. Otherwise, it'll be interpreted as
  // part of the path, perhaps a drive letter.
  return vscode.Uri.file(location.replace(/file:\/\//g, ''));
}
