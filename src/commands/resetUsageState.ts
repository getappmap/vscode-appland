import AppMapEditorProvider from '../editor/appmapEditorProvider';
import * as vscode from 'vscode';
import { LinkTreeDataProvider } from '../tree/linkTreeDataProvider';
import RemoteRecording from '../actions/remoteRecording';
import ExtensionState from '../configuration/extensionState';

export function resetUsageState(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.resetUsageState', async () => {
      extensionState.resetState();
      AppMapEditorProvider.resetState(context);
      LinkTreeDataProvider.resetState(context);
      RemoteRecording.resetState(context);
      vscode.window.showInformationMessage('AppMap usage state was reset.');
    })
  );
}
