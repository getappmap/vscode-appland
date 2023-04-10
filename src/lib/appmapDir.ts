import { readFile, writeFile } from 'fs/promises';
import { load } from 'js-yaml';
import assert from 'node:assert';
import { join } from 'path';
import { fileExists } from '../util';

export async function lookupAppMapDir(folder: string): Promise<string | undefined> {
  const appmapConfigFilePath = join(folder, 'appmap.yml');
  if (await fileExists(appmapConfigFilePath)) {
    try {
      const appmapConfig = load(await readFile(appmapConfigFilePath, 'utf-8'));
      assert(appmapConfig && typeof appmapConfig === 'object');
      if ('appmap_dir' in appmapConfig && typeof appmapConfig.appmap_dir === 'string')
        return appmapConfig.appmap_dir;
    } catch {
      // Unparseable AppMap config, or related error.
    }
  }
}

export async function saveAppMapDir(folder: string, appmapDir: string): Promise<void> {
  const appmapConfigFilePath = join(folder, 'appmap.yml');
  if (await fileExists(appmapConfigFilePath)) {
    let appmapConfig: unknown;
    try {
      appmapConfig = load(await readFile(appmapConfigFilePath, 'utf-8'));
      assert(appmapConfig && typeof appmapConfig === 'object');
    } catch (e) {
      // Unparseable AppMap config, or related error.
      console.warn(e);
      return;
    }
    appmapConfig['appmap_dir'] = appmapDir;
    await writeFile(appmapConfigFilePath, appmapDir);
  }
}
