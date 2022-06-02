import { AppMapTextEditorProvider } from './textEditor/appmapTextEditorProvider';
import * as vscode from 'vscode';
import { LinkTreeDataProvider } from './tree/linkTreeDataProvider';
import RemoteRecording from './actions/remoteRecording';
import ExtensionState from './configuration/extensionState';
import { AppmapUploader } from './actions/appmapUploader';

export function registerUtilityCommands(
  context: vscode.ExtensionContext,
  extensionState: ExtensionState
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.resetUsageState', async () => {
      extensionState.resetState();
      AppMapTextEditorProvider.resetState(context);
      LinkTreeDataProvider.resetState(context);
      RemoteRecording.resetState(context);
      AppmapUploader.resetState(context);
      vscode.window.showInformationMessage('AppMap usage state was reset.');
    })
  );
}
