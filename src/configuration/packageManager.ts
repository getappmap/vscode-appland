import { Uri } from 'vscode';
import { resolveFilePath } from '../util';

export async function packageManagerCommand(folder: Uri): Promise<string[]> {
  const npmLockFile = await resolveFilePath(folder.fsPath, 'package-lock.json');
  const yarnLockFile = await resolveFilePath(folder.fsPath, 'yarn.lock');

  const args: string[] = [];
  if (yarnLockFile) {
    args.unshift('run');
    args.unshift('yarn');
  } else if (npmLockFile) {
    args.unshift('--');
    args.unshift('exec');
    args.unshift('npm');
  }
  return args;
}
