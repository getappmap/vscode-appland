import * as vscode from 'vscode';
import { constants as fsConstants, promises as fs } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import { bent } from 'bent';

const APPLAND_CONF_PATH = '~/.appland';
const APPLAND_DEFAULT_URL = 'https://app.land';

export default class AppLandClientConfig {
  public apiUrl: string;
  public apiKey: string;
  private httpClient: any;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
    this.httpClient = bent(this.apiUrl, {
      Authorization: `Bearer "${apiKey}"`,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
  public makeRequest(...args: (string | number)[]): any {
    return this.httpClient(...args);
  }

  public static async fromEnvironment(): Promise<AppLandClientConfig> {
    const { APPLAND_API_KEY, APPLAND_URL } = process.env;
    let apiKey = APPLAND_API_KEY || '';
    let apiUrl = APPLAND_URL || APPLAND_DEFAULT_URL;

    if (!apiKey || !apiUrl) {
      try {
        await fs.access(APPLAND_CONF_PATH, fsConstants.R_OK);
        const buf = await fs.readFile(APPLAND_CONF_PATH);
        const config = yaml.load(buf);
        const { contexts } = config;
        if (contexts && contexts.default) {
          apiKey = apiKey || contexts.default.api_key;
          apiUrl = apiUrl || contexts.default.url;
        }
      } catch (e) {
        console.error(e);
        console.trace();
      }
    }

    return new AppLandClientConfig(apiUrl, apiKey);
  }
}
