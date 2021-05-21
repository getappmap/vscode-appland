import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseUpdater } from './databaseUpdater';
import { ScenarioProvider } from './scenarioViewer';
import Telemetry from './telemetry';
import registerTrees from './tree';
import AppMapCollectionFile from './appmapCollectionFile';
import RemoteRecording from './remoteRecording';
import { notEmpty, isFileExists } from './util';

async function getBaseUrl(): Promise<string | undefined> {
  return await vscode.window.showInputBox({
    placeHolder: 'URL of remote recording server, eg "http://localhost:3000"',
  });
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const localAppMaps = new AppMapCollectionFile();

  Telemetry.register(context);
  ScenarioProvider.register(context);
  DatabaseUpdater.register(context);

  localAppMaps.initialize();
  const { localTree } = registerTrees(localAppMaps);

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.applyFilter', async () => {
      const filter = await vscode.window.showInputBox({
        placeHolder:
          'Enter a case sensitive partial match or leave this input empty to clear an existing filter',
      });

      localAppMaps.setFilter(filter || '');
      localTree.reveal(localAppMaps.appmapDescriptors[0], { select: false });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.findByName', async () => {
      const items = localAppMaps
        .allDescriptors()
        .map((d) => d.metadata?.name as string)
        .filter(notEmpty)
        .sort();

      const name = await vscode.window.showQuickPick(items, {});
      if (!name) {
        return;
      }

      const descriptor = localAppMaps.findByName(name);
      if (!descriptor) {
        return;
      }

      vscode.commands.executeCommand('vscode.open', descriptor.resourceUri);
    })
  );

  Telemetry.reportStartUp();

  let remoteURL;
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.command = 'appmap.stopRemoteRecording';
  statusBarItem.tooltip = 'Click to stop remote recording';

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.startRemoteRecording', async () => {
      if (remoteURL) {
        vscode.window.showErrorMessage(`Remote recording is already running on ${remoteURL}`);
        return;
      }

      remoteURL = (await getBaseUrl()) || '';

      if (remoteURL === '') {
        return;
      }

      try {
        RemoteRecording.start(remoteURL);

        statusBarItem.text = `$(record) Remote recording is running on ${remoteURL}`;
        statusBarItem.show();

        vscode.window.showInformationMessage(`Recording started at "${remoteURL}"`);
      } catch (e) {
        vscode.window.showErrorMessage(`Start recording failed: ${e.name}: ${e.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.getRemoteRecordingStatus', async () => {
      if (!remoteURL) {
        vscode.window.showErrorMessage('Remote recording is not running');
        return;
      }

      try {
        const recordingStatus = (await RemoteRecording.getStatus(remoteURL))
          ? 'enabled'
          : 'disabled';
        vscode.window.showInformationMessage(
          `Recording status at "${remoteURL}": ${recordingStatus}`
        );
      } catch (e) {
        vscode.window.showErrorMessage(`Recording status failed: ${e.name}: ${e.message}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('appmap.stopRemoteRecording', async () => {
      if (!remoteURL) {
        vscode.window.showErrorMessage('Remote recording is not running');
        return;
      }

      const appmapName = await vscode.window.showInputBox({
        placeHolder: 'AppMap name',
      });

      if (!appmapName) {
        return;
      }

      try {
        const appmap = await RemoteRecording.stop(remoteURL);
        appmap['metadata']['name'] = appmapName;

        statusBarItem.hide();

        let folder: string;
        if (!vscode.workspace.workspaceFolders) {
          folder = vscode.workspace.rootPath as string;
        } else {
          folder = vscode.workspace.workspaceFolders[0].uri.fsPath;
        }

        const fileName = path.join(folder, appmapName.replace(/[^a-zA-Z0-9]/g, '_'));
        const fileExt = '.appmap.json';
        let checkFileName = fileName;
        let i = 0;

        while (isFileExists(checkFileName + fileExt)) {
          i++;
          checkFileName = `${fileName}(${i})`;
        }

        const filePath = checkFileName + fileExt;
        fs.writeFileSync(filePath, JSON.stringify(appmap), 'utf8');

        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');

        vscode.window.showInformationMessage(`Recording stopped at "${remoteURL}"`);

        remoteURL = null;
      } catch (e) {
        vscode.window.showErrorMessage(`Stop recording failed: ${e.name}: ${e.message}`);
      }
    })
  );
}
