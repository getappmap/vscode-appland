import { readFile, writeFile } from 'fs/promises';
import { load } from 'js-yaml';
import { join } from 'path';
import { fileExists } from '../util';

export async function lookupAppMapDir(folder: string): Promise<string | undefined> {
  const appmapConfigFilePath = join(folder, 'appmap.yml');
  if (await fileExists(appmapConfigFilePath)) {
    try {
      const appmapConfig = load(await readFile(appmapConfigFilePath, 'utf-8')) as any;
      return appmapConfig.appmap_dir;
    } catch {
      // Unparseable AppMap config, or related error.
    }
  }
}

export async function saveAppMapDir(folder: string, appmapDir: string): Promise<void> {
  const appmapConfigFilePath = join(folder, 'appmap.yml');
  if (await fileExists(appmapConfigFilePath)) {
    let appmapConfig: any;
    try {
      appmapConfig = load(await readFile(appmapConfigFilePath, 'utf-8')) as any;
    } catch (e) {
      // Unparseable AppMap config, or related error.
      console.warn(e);
      return;
    }
    appmapConfig.appmap_dir = appmapDir;
    await writeFile(appmapConfigFilePath, appmapDir);
  }
}
