import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import RemoteRecordingClient from './remoteRecordingClient';
import { isFileExists } from './util';

export default class RemoteRecording {
  private static readonly storeRecentRemoteUrlsKey = 'APPMAP_RECENT_REMOTE_URLS';
  private readonly statusBar: vscode.StatusBarItem;
  private readonly context: vscode.ExtensionContext;
  private activeRecordingUrl: string | null;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.activeRecordingUrl = null;
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBar.command = 'appmap.stopCurrentRemoteRecording';
    this.statusBar.tooltip = 'Click to stop recording';
  }

  get recentUrls(): string[] {
    return this.context.workspaceState.get(RemoteRecording.storeRecentRemoteUrlsKey) || [];
  }

  addRecentUrl(url: string): void {
    if (url === '') {
      return;
    }

    const { recentUrls } = this;
    if (recentUrls.includes(url)) {
      return;
    }

    this.context.workspaceState.update(RemoteRecording.storeRecentRemoteUrlsKey, [
      ...recentUrls,
      url,
    ]);
  }

  private onBeginRecording(recordingUrl: string): void {
    this.activeRecordingUrl = recordingUrl;
    this.statusBar.text = `$(record) Recording AppMap on ${recordingUrl}`;
    this.statusBar.show();

    vscode.commands.executeCommand('setContext', 'appmap.recordingIsRunning', true);
  }

  public async commandStart(): Promise<void> {
    if (this.activeRecordingUrl) {
      vscode.window.showErrorMessage(`Recording is already enabled on ${this.activeRecordingUrl}`);
      return;
    }

    const recordingUrl = await this.getBaseUrl();
    if (recordingUrl === '') {
      return;
    }

    try {
      await RemoteRecordingClient.start(recordingUrl);

      this.statusBar.text = `$(circle-record) Recording is running on ${recordingUrl}`;
      this.statusBar.show();

      vscode.window.showInformationMessage(`Recording has started at ${recordingUrl}.`);
      this.onBeginRecording(recordingUrl);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to start recording: ${e.name}: ${e.message}`);
      return;
    }

    this.addRecentUrl(recordingUrl);
  }

  private async stop(url: string): Promise<void> {
    if (!url) {
      // We'll consider this a valid case - no error is thrown.
      return;
    }

    const appmapName = await vscode.window.showInputBox({
      placeHolder: 'Enter a name for this AppMap',
    });

    if (!appmapName) {
      return;
    }

    try {
      const appmap = await RemoteRecordingClient.stop(url);
      appmap['metadata']['name'] = appmapName;

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

      vscode.window.showInformationMessage(`Recording successfully stopped at ${url}.`);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to stop recording: ${e.name}: ${e.message}`);
    }
  }

  public async commandStop(): Promise<void> {
    const recordingUrl = await this.getBaseUrl();
    if (recordingUrl == '') {
      return;
    }

    if (recordingUrl === this.activeRecordingUrl) {
      await this.commandStopCurrent();
      return;
    }

    this.stop(recordingUrl);
  }

  public async commandStopCurrent(): Promise<void> {
    if (!this.activeRecordingUrl) {
      vscode.window.showErrorMessage(
        'There is no active recording in progress. Follow the input prompt to continue.'
      );
      await this.commandStop();
      return;
    }

    this.stop(this.activeRecordingUrl);
    this.statusBar.hide();
    this.activeRecordingUrl = null;
    vscode.commands.executeCommand('setContext', 'appmap.recordingIsRunning', false);
  }

  public async commandStatus(): Promise<void> {
    const recordingUrl = await this.getBaseUrl();
    if (recordingUrl === '') {
      return;
    }

    try {
      const recordingStatus = (await RemoteRecordingClient.getStatus(recordingUrl))
        ? 'has an active recording in progress'
        : 'is ready to begin recording';
      vscode.window.showInformationMessage(`${recordingUrl} ${recordingStatus}.`);
      this.addRecentUrl(recordingUrl);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to check recording status: ${e.name}: ${e.message}`);
    }
  }

  async getBaseUrl(): Promise<string> {
    const quickPick = vscode.window.createQuickPick();
    const items: vscode.QuickPickItem[] = [];

    this.recentUrls.forEach((url) => {
      items.push({ label: url });
    });

    return new Promise((resolve) => {
      quickPick.items = items;
      quickPick.placeholder =
        'Enter the URL of an application running an AppMap agent (e.g. http://localhost:3000)';
      quickPick.show();
      quickPick.onDidAccept(() => {
        quickPick.hide();
        resolve(quickPick.selectedItems[0]?.label || quickPick.value);
      });
    });
  }

  static async register(context: vscode.ExtensionContext): Promise<void> {
    const remoteRecording = new RemoteRecording(context);

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.startRemoteRecording', async () => {
        await remoteRecording.commandStart();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.getRemoteRecordingStatus', async () => {
        await remoteRecording.commandStatus();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.stopRemoteRecording', async () => {
        await remoteRecording.commandStop();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('appmap.stopCurrentRemoteRecording', async () => {
        await remoteRecording.commandStopCurrent();
      })
    );
  }
}
