import { PathLike, promises as fsPromises } from 'fs';
import * as YAML from 'yaml';
import { YAMLError } from 'yaml/util';

export interface ConfigProperties {
  'appmap.config.app': string | undefined;
  'appmap.config.content': string;
  'appmap.config.is_valid': boolean;
}

export async function getConfigProperties(configFile: PathLike): Promise<ConfigProperties> {
  const properties: ConfigProperties = {
    'appmap.config.app': undefined,
    'appmap.config.content': await fsPromises.readFile(configFile, 'utf-8'),
    'appmap.config.is_valid': false,
  };

  try {
    const config = YAML.parse(properties['appmap.config.content']);
    if (config.name !== undefined) {
      properties['appmap.config.app'] = config.name;
      properties['appmap.config.is_valid'] = true;
    }
  } catch (error) {
    if (error instanceof YAMLError) properties['appmap.config.is_valid'] = false;
    else throw error;
  }

  return properties;
}
