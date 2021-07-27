import { ScenarioProvider } from './scenarioViewer';
import * as vscode from 'vscode';
import { LinkTreeDataProvider } from './tree/linkTreeDataProvider';
import RemoteRecording from './remoteRecording';
import { QUICKSTART_DOCS_SEEN } from './util';

export function registerUtilityCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.resetUsageState', async () => {
      context.globalState.update(QUICKSTART_DOCS_SEEN, null);
      ScenarioProvider.resetState(context);
      LinkTreeDataProvider.resetState(context);
      RemoteRecording.resetState(context);
      vscode.window.showInformationMessage('AppMap usage state was reset.');
    })
  );
}
