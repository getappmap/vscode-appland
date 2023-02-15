import * as vscode from 'vscode';
import { bestFilePath } from '../lib/bestFilePath';
import { CLICK_CODE_OBJECT, Telemetry } from '../telemetry';

export default async function openCodeObjectInSource(
  context: vscode.ExtensionContext
): Promise<void> {
  const command = vscode.commands.registerCommand(
    'appmap.openCodeObjectInSource',
    async (
      path: string,
      folder?: vscode.WorkspaceFolder,
      showOptions?: vscode.TextDocumentShowOptions,
      prompt?: string
    ) => {
      Telemetry.sendEvent(CLICK_CODE_OBJECT);
      const bestPath = await bestFilePath(path, folder, prompt);
      if (!bestPath) return;
      await vscode.commands.executeCommand('vscode.open', bestPath, showOptions);
    }
  );
  context.subscriptions.push(command);
}
