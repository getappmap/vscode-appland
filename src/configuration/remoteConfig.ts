import * as vscode from 'vscode';
import tryRequest from '../lib/tryRequest';

const CACHE_KEY = 'remoteConfig';
const TIMEOUT_MS = 3000;
const EXCLUDED_KEY = 'appMap.configurationUrl';

type Config = Record<`appMap.${string}`, unknown>;

interface ConfigCache {
  url: string;
  config: Config;
}

export function getConfigUrl(): { url: string; source: 'setting' | 'env var' } | undefined {
  const setting = vscode.workspace.getConfiguration('appMap').get<string>('configurationUrl');
  if (setting) return { url: setting, source: 'setting' };
  const envVar = process.env.APPMAP_CONFIG_URL;
  if (envVar) return { url: envVar, source: 'env var' };
  return undefined;
}

// Serialise concurrent apply() calls so startup fetch and config-change watcher never interleave.
let applyChain: Promise<void> = Promise.resolve();

async function doApply(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel
): Promise<void> {
  const configUrl = getConfigUrl();
  const cached = context.globalState.get<ConfigCache>(CACHE_KEY);

  if (!configUrl) {
    if (cached) {
      const retainedKeys = Object.keys(cached.config);
      if (retainedKeys.length > 0) {
        channel.appendLine(
          `No organization configuration URL is set. Retaining previously applied keys: ${retainedKeys.join(
            ', '
          )}`
        );
      }
      await context.globalState.update(CACHE_KEY, undefined);
    }
    return;
  }

  const { url, source } = configUrl;
  channel.appendLine(`Fetching organization configuration from ${url} (source: ${source})`);

  let fetched: Config | undefined;
  try {
    const result = await Promise.race([
      tryRequest(url),
      new Promise<undefined>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS).unref()
      ),
    ]);

    if (!result) {
      throw new Error('fetch returned no result');
    }

    const raw = await result.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error('response is not a valid JSON object');
    }
    fetched = sanitizeConfig(raw);
  } catch (e) {
    channel.appendLine(`Failed to fetch organization configuration from ${url}: ${e}`);

    if (cached && cached.url === url) {
      channel.appendLine('Using cached configuration.');
      fetched = cached.config;
    } else {
      return;
    }
  }

  const appMapConfig = vscode.workspace.getConfiguration('appMap');
  const newConfig: Config = {};

  async function tryUpdate(subKey: string, value: unknown): Promise<void> {
    try {
      await appMapConfig.update(subKey, value, vscode.ConfigurationTarget.Global);
    } catch (e) {
      channel.appendLine(`Failed to update configuration key ${subKey}: ${e}`);
    }
  }

  // Apply keys from fetched config
  for (const [fullKey, value] of Object.entries(fetched)) {
    const subKey = fullKey.slice('appMap.'.length);
    const current = appMapConfig.get(subKey);
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      channel.appendLine(
        `Setting ${fullKey}: ${JSON.stringify(current)} → ${JSON.stringify(value)}`
      );
      await tryUpdate(subKey, value);
    }
    newConfig[fullKey] = value;
  }

  // Revert keys present in old cache but absent from new fetch
  if (cached) {
    for (const oldKey of Object.keys(cached.config)) {
      if (!(oldKey in newConfig)) {
        const subKey = oldKey.slice('appMap.'.length);
        channel.appendLine(`Reverting ${oldKey}`);
        await tryUpdate(subKey, undefined);
      }
    }
  }

  await context.globalState.update(CACHE_KEY, { url, config: newConfig });
}

function sanitizeConfig(raw: object): Config {
  const sanitized: Config = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith('appMap.') || key === EXCLUDED_KEY) continue;
    sanitized[key] = value;
  }
  return sanitized;
}

export default class RemoteConfig {
  static apply(context: vscode.ExtensionContext, channel: vscode.OutputChannel): Promise<void> {
    applyChain = applyChain
      .then(() => doApply(context, channel))
      .catch((error) => {
        channel.appendLine(`Failed to apply organization configuration: ${error}`);
      });
    return applyChain;
  }
}
