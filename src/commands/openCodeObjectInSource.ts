import * as vscode from 'vscode';
import { CLICK_CODE_OBJECT, Telemetry } from '../telemetry';

export default async function openCodeObjectInSource(
  context: vscode.ExtensionContext
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.openCodeObjectInSource',
    async (uri, showOptions) => {
      Telemetry.sendEvent(CLICK_CODE_OBJECT);
      await vscode.commands.executeCommand('vscode.open', uri, showOptions);
    }
  );
  context.subscriptions.push(command);
}
