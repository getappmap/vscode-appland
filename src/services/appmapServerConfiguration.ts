import { setConfiguration } from '@appland/client/dist/src/loadConfiguration';
import * as vscode from 'vscode';
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

  static updateAppMapClientConfiguration(): void {
    const serverURL = ExtensionSettings.appMapServerURL();
    setConfiguration({ baseURL: serverURL.toString() });
  }
}
