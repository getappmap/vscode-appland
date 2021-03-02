import { constants as fsConstants, promises as fs } from 'fs';
import * as yaml from 'js-yaml';
import * as bent from 'bent';
import { homedir } from 'os';
import { join } from 'path';

const APPLAND_CONF_PATH = join(homedir(), '.appland');
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
  public makeRequest(...args: any[]): any {
    return this.httpClient(...args);
  }

  public static async fromEnvironment(): Promise<AppLandClientConfig> {
    const { APPLAND_API_KEY, APPLAND_URL } = process.env;
    let apiKey = APPLAND_API_KEY || '';
    let apiUrl = APPLAND_URL;

    if (!apiKey || !apiUrl) {
      try {
        await fs.access(APPLAND_CONF_PATH, fsConstants.R_OK);
        const buf = await fs.readFile(APPLAND_CONF_PATH);
        const config = yaml.load(buf);
        const { contexts, current_context: currentContext } = config;
        if (contexts && contexts[currentContext]) {
          const { api_key: contextApiKey, url } = contexts[currentContext];
          apiKey = apiKey || contextApiKey;
          apiUrl = apiUrl || url;
        }
      } catch (e) {
        console.error(e);
        console.trace();
      }
    }

    apiUrl = apiUrl || APPLAND_DEFAULT_URL;

    return new AppLandClientConfig(apiUrl, apiKey);
  }
}
