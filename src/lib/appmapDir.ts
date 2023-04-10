import { readFile, writeFile } from 'fs/promises';
import { load } from 'js-yaml';
import assert from 'node:assert';
import { dirname, join } from 'path';
import { fileExists } from '../util';

export type AppMapConfig = {
  appmapDir: string;
  configFolder: string;
};

export async function appMapConfigFromFile(
  configFilePath: string
): Promise<AppMapConfig | undefined> {
  if (await fileExists(configFilePath)) {
    const result = {} as AppMapConfig;

    try {
      const appmapConfig = load(await readFile(configFilePath, 'utf-8'));
      assert(appmapConfig && typeof appmapConfig === 'object');

      result.configFolder = dirname(configFilePath);

      if ('appmap_dir' in appmapConfig && typeof appmapConfig.appmap_dir === 'string')
        result.appmapDir = appmapConfig.appmap_dir;

      return result;
    } catch {
      // Unparseable AppMap config, or related error.
    }
  }
}

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
