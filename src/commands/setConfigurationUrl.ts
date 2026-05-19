import * as vscode from 'vscode';
import { getConfigUrl } from '../configuration/remoteConfig';

export default async function setConfigurationUrl(): Promise<void> {
  const value = await vscode.window.showInputBox({
    prompt: 'Enter the organization configuration URL',
    value: getConfigUrl()?.url || '',
  });

  if (value === undefined) return;

  await vscode.workspace
    .getConfiguration('appMap')
    .update('configurationUrl', value || undefined, vscode.ConfigurationTarget.Global);
}
