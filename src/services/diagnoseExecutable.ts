import { execFile } from 'node:child_process';
import { lstat, readlink, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

import { displayPath } from '../assets/helpers';

// What can be said about a program that would not run. A process killed by a signal before
// it writes anything leaves no other evidence behind -- no log, no exit status -- so the
// file it was supposed to be is all there is left to look at.
export type ExecutableDiagnosis = {
  // Home abbreviated to ~, as everywhere else we show a path.
  path: string;
  // Where a symlink points, whether or not anything is there.
  target?: string;
  missing?: true;
  size?: number;
  // Permission bits, octal.
  mode?: string;
  // 'ok', why it was rejected, or why we couldn't tell. macOS only.
  signature?: string;
  // Absent when the check couldn't run: false has to mean we asked.
  quarantined?: boolean;
};

export type CommandResult = {
  // Absent if the command never ran -- missing, refused, or timed out -- as opposed to
  // running and reporting a failure.
  code?: number;
  stderr: string;
};

export type RunCommand = (file: string, args: string[]) => Promise<CommandResult>;

export type DiagnoseOptions = {
  run?: RunCommand;
  platform?: NodeJS.Platform;
};

const COMMAND_TIMEOUT = 5000;

const runCommand: RunCommand = async (file, args) => {
  try {
    const { stderr } = await promisify(execFile)(file, args, { timeout: COMMAND_TIMEOUT });
    return { code: 0, stderr };
  } catch (e) {
    // execFile rejects both for a command that failed and for one that never ran; only the
    // former carries an exit status. A spawn error puts a string in `code` (ENOENT), and a
    // timeout leaves it null.
    const failure = e as { code?: number | string; stderr?: string };
    return {
      code: typeof failure.code === 'number' ? failure.code : undefined,
      stderr: failure.stderr || String(e),
    };
  }
};

function describeSignature(result: CommandResult, path: string): string {
  // Keep the reason: on a platform where codesign is standard, not being able to run it is
  // itself worth knowing, and more specific than saying only that we couldn't.
  if (result.code === undefined) return `unavailable: ${summarize(result.stderr, path)}`;
  return result.code === 0 ? 'ok' : summarize(result.stderr, path);
}

// codesign prefixes its complaint with the path it was given, which we already report.
function summarize(stderr: string, path: string): string {
  const line = stderr.split('\n').find((l) => l.trim()) ?? '';
  return (
    line
      .replace(path, '')
      .replace(/^[:\s]+/, '')
      .slice(0, 200) || 'rejected'
  );
}

export default async function diagnoseExecutable(
  path: string,
  { run = runCommand, platform = process.platform }: DiagnoseOptions = {}
): Promise<ExecutableDiagnosis> {
  const diagnosis: ExecutableDiagnosis = { path: displayPath(path) };

  try {
    const link = await lstat(path);
    if (link.isSymbolicLink()) diagnosis.target = resolve(dirname(path), await readlink(path));
  } catch {
    // Reported as missing by the stat below.
  }

  try {
    const file = await stat(path); // through the symlink, if it is one
    diagnosis.size = file.size;
    diagnosis.mode = (file.mode & 0o777).toString(8);
  } catch {
    diagnosis.missing = true;
    return diagnosis;
  }

  // An ad-hoc signature is mandatory on Apple Silicon, and the kernel SIGKILLs a binary
  // whose signature does not check out. Everywhere else these tools don't exist.
  if (platform !== 'darwin') return diagnosis;

  try {
    diagnosis.signature = describeSignature(
      await run('codesign', ['--verify', '--strict', path]),
      path
    );

    // Gatekeeper refuses a quarantined file. Nothing we write should carry the attribute,
    // so finding one would say something arrived by a path we don't know about. Left unsaid
    // if the check didn't run, rather than answering a question we couldn't ask.
    const quarantine = await run('xattr', ['-p', 'com.apple.quarantine', path]);
    if (quarantine.code !== undefined) diagnosis.quarantined = quarantine.code === 0;
  } catch {
    // A runner that throws rather than reporting failure; diagnosing a failure is not worth
    // failing over.
    diagnosis.signature ??= 'unavailable';
  }

  return diagnosis;
}
