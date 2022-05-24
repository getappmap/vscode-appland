import { parse, resolve } from 'path';
import { Uri } from 'vscode';
import { fileExists } from '../util';

export async function packageManagerCommand(folder: Uri): Promise<string[]> {
  const dirWithFile = async (dirName: string, fileName: string): Promise<string | undefined> => {
    const filePath = resolve(dirName, fileName);
    if (await fileExists(filePath)) return filePath;

    if (dirName === parse(dirName).root) return;

    return dirWithFile(resolve(dirName, '..'), fileName);
  };

  const npmLockFile = await dirWithFile(folder.fsPath, 'package-lock.json');
  const yarnLockFile = await dirWithFile(folder.fsPath, 'yarn.lock');

  const args: string[] = [];
  if (yarnLockFile) {
    args.unshift('run');
    args.unshift('yarn');
  } else if (npmLockFile) {
    args.unshift('--');
    args.unshift('exec');
    args.unshift('npm');
  } else {
    console.warn(`Neither package-lock.json nor yarn.lock found in ${folder.fsPath}`);
  }
  return args;
}
