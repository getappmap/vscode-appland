import * as vscode from 'vscode';
import RemoteConfig, { getConfigUrl, type Config } from '../configuration/remoteConfig';

export default async function setConfigurationUrl(
  context: vscode.ExtensionContext,
  channel?: vscode.OutputChannel
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

    await RemoteConfig.applyLocalConfig(sanitized, channel);
    if (channel) {
      channel.appendLine(`Successfully applied configuration from local file: ${uri.fsPath}`);
    }
    vscode.window.showInformationMessage(
      'Successfully applied local organization configuration. These settings will persist until changed manually.'
    );
  }
}
