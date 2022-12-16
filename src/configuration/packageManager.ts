import { parse, resolve } from 'path';
import { stringify } from 'querystring';
import { Uri } from 'vscode';
import { fileExists } from '../util';

export async function packageManagerCommand(
  folder: Uri
): Promise<[string[], Record<string, string>]> {
  const dirWithFile = async (dirName: string, fileName: string): Promise<string | undefined> => {
    const filePath = resolve(dirName, fileName);
    if (await fileExists(filePath)) return filePath;

    if (dirName === parse(dirName).root) return;

    return dirWithFile(resolve(dirName, '..'), fileName);
  };

  const npmLockFile = await dirWithFile(folder.fsPath, 'package-lock.json');
  const yarnLockFile = await dirWithFile(folder.fsPath, 'yarn.lock');

  const args: string[] = [];
  const environment: Record<string, string> = {};
  if (yarnLockFile) {
    args.unshift('run');
    args.unshift('yarn');
    environment['YARN_CHECKSUM_BEHAVIOR'] = 'update';
  } else if (npmLockFile) {
    args.unshift('--');
    args.unshift('exec');
    args.unshift('npm');
  } else {
    console.warn(`Neither package-lock.json nor yarn.lock found in ${folder.fsPath}`);
  }
  return [args, environment];
}
