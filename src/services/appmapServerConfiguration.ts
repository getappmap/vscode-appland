import { Configuration } from '@appland/client';
import { setConfiguration } from '@appland/client/dist/src/loadConfiguration';
import * as vscode from 'vscode';
import { getApiKey } from '../authentication';
import ExtensionSettings from '../configuration/extensionSettings';

export default class AppMapServerConfiguration implements vscode.Disposable {
  listener: vscode.Disposable;

  constructor() {
    AppMapServerConfiguration.updateAppMapClientConfiguration();

    this.listener = vscode.workspace.onDidChangeConfiguration((e) => {
      // Cast a wide net. It's cheap.
      if (e.affectsConfiguration('appMap')) {
        AppMapServerConfiguration.updateAppMapClientConfiguration();
      }
    });
  }

  dispose(): void {
    this.listener.dispose();
  }

  static enroll(context: vscode.ExtensionContext): void {
    context.subscriptions.push(new AppMapServerConfiguration());
  }

  static async updateAppMapClientConfiguration(): Promise<void> {
    const serverURL = ExtensionSettings.appMapServerURL;
    // Suppress error due to missing apiURL
    const configuration: Configuration = {
      baseURL: serverURL.toString(),
    } as unknown as Configuration;
    const apiKey = await getApiKey(false);
    if (apiKey) configuration.apiKey = apiKey;

    setConfiguration(configuration);
  }
}
