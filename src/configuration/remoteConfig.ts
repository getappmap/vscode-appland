import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import tryRequest from '../lib/tryRequest';
import { clearCustomerId, getCustomerId, setCustomerId } from './customerId';

// Record of what the organization configuration applied. Retained when the URL goes away —
// nothing is re-applied without a URL, but this is the only thing a later rollback can work
// from. Dropped only by an explicit rollback.
const CACHE_KEY = 'remoteConfig';
// Record that an organization configuration has been applied at least once. It drives UI
// affordances such as hiding the sign-in screen's "apply your organization's configuration"
// prompt, and survives the URL being removed; only an explicit rollback clears it.
const APPLIED_MARKER_KEY = 'orgConfigAppliedAt';
const TIMEOUT_MS = 3000;
const EXCLUDED_KEY = 'appMap.configurationUrl';
const CUSTOMER_ID_KEY = 'appMap.customerId';

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

// Diverted to globalState rather than written through getConfiguration().update(), which
// would throw in a public build where the key is not a registered setting.
async function applyCustomerId(
  context: vscode.ExtensionContext,
  value: unknown,
  channel?: vscode.OutputChannel
): Promise<void> {
  const current = getCustomerId(context);
  const applied =
    typeof value === 'string'
      ? await setCustomerId(context, value, 'orgConfig')
      : await clearCustomerId(context);

  if (applied !== current && channel) {
    channel.appendLine(
      `Setting ${CUSTOMER_ID_KEY}: ${JSON.stringify(current)} → ${JSON.stringify(applied)}`
    );
  }
}

async function applyConfigKeys(
  context: vscode.ExtensionContext,
  config: Config,
  channel?: vscode.OutputChannel
): Promise<void> {
  const appMapConfig = vscode.workspace.getConfiguration('appMap');
  for (const [fullKey, value] of Object.entries(config)) {
    if (fullKey === CUSTOMER_ID_KEY) {
      await applyCustomerId(context, value, channel);
      continue;
    }

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

// Undo a single key previously applied from an organization configuration.
//
// A key the user has edited since it was applied is left alone — at that point the value is
// theirs, not ours to revert. The customer ID is exempt: it is reverted unconditionally,
// because entitlement has no other recovery path (the setting is inert and globalState is not
// user-editable). Clearing it reseeds, so on a bundled build the installation's own ID returns.
async function revertConfigKey(
  context: vscode.ExtensionContext,
  fullKey: string,
  appliedValue: unknown,
  channel?: vscode.OutputChannel
): Promise<void> {
  if (fullKey === CUSTOMER_ID_KEY) {
    if (channel) channel.appendLine(`Reverting ${fullKey}`);
    await clearCustomerId(context);
    return;
  }

  const subKey = fullKey.slice('appMap.'.length);
  const appMapConfig = vscode.workspace.getConfiguration('appMap');
  const current = appMapConfig.get(subKey);

  if (JSON.stringify(current) !== JSON.stringify(appliedValue)) {
    if (channel) {
      channel.appendLine(
        `Keeping ${fullKey}: changed since it was applied (${JSON.stringify(current)})`
      );
    }
    return;
  }

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

async function rollbackRemoteConfig(
  context: vscode.ExtensionContext,
  channel?: vscode.OutputChannel
): Promise<void> {
  const cached = context.globalState.get<ConfigCache>(CACHE_KEY);

  for (const [fullKey, appliedValue] of Object.entries(cached?.config ?? {})) {
    // Handled below, unconditionally, so that it works even with no cache to walk.
    if (fullKey === CUSTOMER_ID_KEY) continue;
    await revertConfigKey(context, fullKey, appliedValue, channel);
  }

  if (getCustomerId(context) !== undefined) {
    await revertConfigKey(context, CUSTOMER_ID_KEY, undefined, channel);
  }

  await context.globalState.update(CACHE_KEY, undefined);
  // Cleared along with everything else: this is an explicit undo, so the sign-in view's
  // "apply your organization's configuration" prompt should be offered again.
  await context.globalState.update(APPLIED_MARKER_KEY, undefined);
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
      // The cache is deliberately kept. Nothing is re-applied without a URL — this branch
      // applies nothing — but it stays as the record of what was applied, which is the only
      // thing the clear command has to revert from. Dropping it here used to make clearing a
      // no-op for anyone who removed the URL first.
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
  await applyConfigKeys(context, fetched, channel);

  // Revert keys present in old cache but absent from new fetch
  if (cached) {
    for (const [oldKey, oldValue] of Object.entries(cached.config)) {
      if (!(oldKey in fetched)) await revertConfigKey(context, oldKey, oldValue, channel);
    }
  }

  await context.globalState.update(CACHE_KEY, { url, config: fetched });
  await context.globalState.update(APPLIED_MARKER_KEY, Date.now());
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

  static applyLocalConfig(
    context: vscode.ExtensionContext,
    config: Config,
    channel?: vscode.OutputChannel
  ): Promise<void> {
    applyChain = applyChain
      .then(() => applyConfigKeys(context, config, channel))
      .catch(() => undefined);
    return applyChain;
  }

  static async rollbackRemoteConfig(
    context: vscode.ExtensionContext,
    channel?: vscode.OutputChannel
  ): Promise<void> {
    return rollbackRemoteConfig(context, channel);
  }

  static async markApplied(context: vscode.ExtensionContext): Promise<void> {
    await context.globalState.update(APPLIED_MARKER_KEY, Date.now());
  }

  static isApplied(context: vscode.ExtensionContext): boolean {
    return (
      getConfigUrl() !== undefined || context.globalState.get(APPLIED_MARKER_KEY) !== undefined
    );
  }
}
