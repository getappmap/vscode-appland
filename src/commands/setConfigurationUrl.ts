import * as vscode from 'vscode';
import RemoteConfig, { getConfigUrl, type Config } from '../configuration/remoteConfig';
import { getCustomerId, getCustomerIdState } from '../configuration/customerId';

export default async function setConfigurationUrl(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel
): Promise<void> {
  const options = [
    {
      label: 'Set URL',
      description: 'Enter organization configuration URL to automatically fetch configuration',
      key: 'url',
    },
    {
      label: 'Local File',
      description: 'Browse for a local JSON configuration file to one-shot apply it',
      key: 'file',
    },
    {
      label: 'Clear',
      description: 'Revert applied settings and remove the organization configuration',
      key: 'clear',
    },
    {
      label: 'Status',
      description: 'Show the active organization configuration and entitlement',
      key: 'status',
    },
  ];

  const picked = await vscode.window.showQuickPick(options, {
    placeHolder: 'Select how you want to configure organization settings',
  });

  if (!picked) return;

  if (picked.key === 'url') {
    const value = await vscode.window.showInputBox({
      prompt: 'Enter the organization configuration URL',
      value: getConfigUrl()?.url || '',
    });

    if (value === undefined) return;

    await vscode.workspace
      .getConfiguration('appMap')
      .update('configurationUrl', value || undefined, vscode.ConfigurationTarget.Global);
  } else if (picked.key === 'file') {
    const fileUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: {
        'JSON Files': ['json'],
      },
      openLabel: 'Apply Config',
    });

    if (!fileUris || fileUris.length === 0) return;

    const uri = fileUris[0];
    let sanitized: Config;
    try {
      sanitized = await RemoteConfig.readAndParseLocalConfig(uri.fsPath);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      vscode.window.showErrorMessage(`Failed to parse configuration file: ${message}`);
      return;
    }

    const configUrl = getConfigUrl();
    if (configUrl) {
      await RemoteConfig.rollbackRemoteConfig(context, channel);
      if (configUrl.source === 'setting') {
        await vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', undefined, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          'An organization configuration URL was active. It has been removed and its settings have been reset before applying the new configuration.'
        );
      } else {
        vscode.window.showInformationMessage(
          'An organization configuration URL was active. Its settings have been reset before applying the new configuration. Note that the environment variable APPMAP_CONFIG_URL is still set, so those settings will be re-applied on the next extension activation.'
        );
      }
    }

    await RemoteConfig.applyLocalConfig(context, sanitized, channel);
    await RemoteConfig.markApplied(context);
    channel.appendLine(`Successfully applied configuration from local file: ${uri.fsPath}`);
    vscode.window.showInformationMessage(
      'Successfully applied local organization configuration. These settings will persist until changed manually.'
    );
  } else if (picked.key === 'clear') {
    await clearOrganizationConfiguration(context, channel);
  } else if (picked.key === 'status') {
    channel.appendLine(describeStatus(context));
  }
}

async function clearOrganizationConfiguration(
  context: vscode.ExtensionContext,
  channel?: vscode.OutputChannel
): Promise<void> {
  const configUrl = getConfigUrl();

  // Reverts every key the cached configuration applied, the customer ID included, and drops
  // the cache. Clearing the customer ID reseeds synchronously, so the value reported below is
  // the one the user is actually left with rather than one that reappears on the next reload.
  await RemoteConfig.rollbackRemoteConfig(context, channel);

  if (configUrl?.source === 'setting') {
    await vscode.workspace
      .getConfiguration('appMap')
      .update('configurationUrl', undefined, vscode.ConfigurationTarget.Global);
  }

  if (channel) channel.appendLine('Cleared organization configuration.');

  const customerId = getCustomerId(context);
  const message = ['Organization configuration cleared and its settings reverted.'];

  if (customerId) {
    message.push(
      `The customer ID has been reset to the value from your installation (${customerId}).`
    );
  }

  // One notification per action. An environment variable the extension cannot unset is a
  // caveat on this outcome rather than a separate event, so it escalates the message instead
  // of stacking a second toast on top of it.
  if (configUrl?.source === 'env var') {
    message.push(
      `The URL comes from the environment variable APPMAP_CONFIG_URL (${configUrl.url}), which the extension cannot unset, so the configuration will be applied again on the next activation unless the variable is removed.`
    );
    vscode.window.showWarningMessage(message.join(' '));
  } else {
    vscode.window.showInformationMessage(message.join(' '));
  }
}

function describeStatus(context: vscode.ExtensionContext): string {
  const state = getCustomerIdState(context);
  const entitlement = !state
    ? 'This installation is not entitled by a customer ID.'
    : state.source === 'bundled'
    ? `Entitled via bundled installation (customer ID ${state.value}).`
    : `Entitled via organization config (customer ID ${state.value}).`;

  const configUrl = getConfigUrl();
  const url = configUrl
    ? `Organization configuration URL: ${configUrl.url} (source: ${configUrl.source}).`
    : 'No organization configuration URL is set.';

  return [entitlement, url].join('\n');
}
