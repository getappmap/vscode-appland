import * as vscode from 'vscode';
import { RequestHandler } from './uriHandler';

const stateWelcomeKey = 'appmap.displayEarlyAccessWelcome';

export async function tryDisplayEarlyAccessWelcome(
  context: vscode.ExtensionContext
): Promise<void> {
  if (context.globalState.get(stateWelcomeKey) === true) {
    await context.globalState.update(stateWelcomeKey, undefined);
    vscode.window.showInformationMessage(
      'AppMap early access features have successfully been enabled.'
    );
  }
}

export default class EarlyAccessUriHandler implements RequestHandler {
  public readonly path = '/early-access';

  constructor(protected readonly context: vscode.ExtensionContext) {}

  async handle(): Promise<void> {
    vscode.workspace
      .getConfiguration('appMap')
      .update('findingsEnabled', true, vscode.ConfigurationTarget.Global);

    const msg = [
      'Thank you for joining the AppMap early access program!',
      'To enable early access features, the window must be reloaded.',
      'Reload the window now?',
    ].join('\n');
    const response = await vscode.window.showInformationMessage(msg, 'Yes', 'No');
    if (response === 'Yes') {
      await this.context.globalState.update(stateWelcomeKey, true);
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  dispose(): void {
    // do nothing, we have nothing to dispose
  }
}
