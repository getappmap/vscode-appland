import * as vscode from 'vscode';
import AppMapEditorProvider from '../editor/appmapEditorProvider';

export default async function appMapOpen(context: vscode.ExtensionContext): Promise<void> {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'appmap.open',
      async (appMapUri, state?: string | Record<string, unknown>) => {
        vscode.commands.executeCommand('vscode.open', appMapUri);
        const ready = await AppMapEditorProvider.webviewReady(appMapUri);
        if (ready && state) AppMapEditorProvider.setState(appMapUri, state);
      }
    )
  );
}
