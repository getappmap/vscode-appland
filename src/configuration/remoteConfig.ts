import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import tryRequest from '../lib/tryRequest';

const CACHE_KEY = 'remoteConfig';
const TIMEOUT_MS = 3000;
const EXCLUDED_KEY = 'appMap.configurationUrl';

export type Config = Record<`appMap.${string}`, unknown>;

interface ConfigCache {
  url: string;
  config: Config;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

async function readAndParseLocalConfig(fsPath: string): Promise<Config> {
  const content = await fs.readFile(fsPath, 'utf8');
  const parsed = JSON.parse(content);
  return sanitizeConfig(parsed);
}

function sanitizeConfig(raw: unknown): Config {
  if (!isRecord(raw)) {
    throw new Error('Configuration is not a valid JSON object');
  }

  const sanitized: Config = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith('appMap.') || key === EXCLUDED_KEY) continue;
    sanitized[key as `appMap.${string}`] = value;
  }
  return sanitized;
}

async function applyConfigKeys(config: Config, channel?: vscode.OutputChannel): Promise<void> {
  const appMapConfig = vscode.workspace.getConfiguration('appMap');
  for (const [fullKey, value] of Object.entries(config)) {
    const subKey = fullKey.slice('appMap.'.length);
    const current = appMapConfig.get(subKey);
    if (JSON.stringify(current) !== JSON.stringify(value)) {
      if (channel) {
        channel.appendLine(
          `Setting ${fullKey}: ${JSON.stringify(current)} → ${JSON.stringify(value)}`
        );
      }
      try {
        await appMapConfig.update(subKey, value, vscode.ConfigurationTarget.Global);
      } catch (e) {
        if (channel) {
          channel.appendLine(`Failed to update configuration key ${subKey}: ${e}`);
        }
      }
    }
  }
}

async function rollbackRemoteConfig(
  context: vscode.ExtensionContext,
  channel?: vscode.OutputChannel
): Promise<void> {
  const cached = context.globalState.get<ConfigCache>(CACHE_KEY);
  if (cached) {
    const appMapConfig = vscode.workspace.getConfiguration('appMap');
    for (const fullKey of Object.keys(cached.config)) {
      const subKey = fullKey.slice('appMap.'.length);
      if (channel) {
        channel.appendLine(`Reverting ${fullKey}`);
      }
      try {
        await appMapConfig.update(subKey, undefined, vscode.ConfigurationTarget.Global);
      } catch (e) {
        if (channel) {
          channel.appendLine(`Failed to update configuration key ${subKey}: ${e}`);
        }
      }
    }
    await context.globalState.update(CACHE_KEY, undefined);
  }
}

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

  // Apply keys from fetched config
  await applyConfigKeys(fetched, channel);

  // Revert keys present in old cache but absent from new fetch
  if (cached) {
    const appMapConfig = vscode.workspace.getConfiguration('appMap');
    for (const oldKey of Object.keys(cached.config)) {
      if (!(oldKey in fetched)) {
        const subKey = oldKey.slice('appMap.'.length);
        channel.appendLine(`Reverting ${oldKey}`);
        try {
          await appMapConfig.update(subKey, undefined, vscode.ConfigurationTarget.Global);
        } catch (e) {
          channel.appendLine(`Failed to update configuration key ${subKey}: ${e}`);
        }
      }
    }
  }

  await context.globalState.update(CACHE_KEY, { url, config: fetched });
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

  // Structured as static class methods rather than exported free functions to bypass
  // ES Module static binding limitations during unit testing. This allows Sinon to
  // stub them reliably via dynamic property lookup at runtime.

  static async readAndParseLocalConfig(fsPath: string): Promise<Config> {
    return readAndParseLocalConfig(fsPath);
  }

  static async applyConfigKeys(config: Config, channel?: vscode.OutputChannel): Promise<void> {
    return applyConfigKeys(config, channel);
  }

  static applyLocalConfig(config: Config, channel?: vscode.OutputChannel): Promise<void> {
    applyChain = applyChain.then(() => applyConfigKeys(config, channel)).catch(() => undefined);
    return applyChain;
  }

  static async rollbackRemoteConfig(
    context: vscode.ExtensionContext,
    channel?: vscode.OutputChannel
  ): Promise<void> {
    return rollbackRemoteConfig(context, channel);
  }
}
