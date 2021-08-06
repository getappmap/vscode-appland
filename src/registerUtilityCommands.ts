import { ScenarioProvider } from './scenarioViewer';
import * as vscode from 'vscode';
import { LinkTreeDataProvider } from './tree/linkTreeDataProvider';
import RemoteRecording from './remoteRecording';
import AppMapProperties from './appmapProperties';
import { AppmapUploader } from './appmapUploader';

export function registerUtilityCommands(
  context: vscode.ExtensionContext,
  properties: AppMapProperties
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.resetUsageState', async () => {
      properties.resetState();
      ScenarioProvider.resetState(context);
      LinkTreeDataProvider.resetState(context);
      RemoteRecording.resetState(context);
      AppmapUploader.resetState(context);
      vscode.window.showInformationMessage('AppMap usage state was reset.');
    })
  );
}
