import * as vscode from 'vscode';

import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import RemoteRecordingClient from './remoteRecordingClient';
import { resolveFilePath } from '../util';
import { promisify } from 'util';
import { WorkspaceServices } from '../services/workspaceServices';
import { AppmapConfigManager, AppmapConfigManagerInstance } from '../services/appmapConfigManager';
import chooseWorkspace from '../lib/chooseWorkspace';
import { existsSync } from 'fs';

export default class RemoteRecording {
  private static readonly RECENT_REMOTE_URLS = 'APPMAP_RECENT_REMOTE_URLS';
  private readonly statusBar: vscode.StatusBarItem;
  private activeRecordingUrl: string | null;
  private stopEmitter: vscode.EventEmitter<boolean> | null = null;
  onDidStop: vscode.Event<boolean> | undefined = this.stopEmitter?.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private workspaceServices: WorkspaceServices
  ) {
    this.activeRecordingUrl = null;
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    context.subscriptions.push(this.statusBar);
    this.statusBar.command = 'appmap.stopCurrentRemoteRecording';
    this.statusBar.tooltip = 'Click to stop recording';
  }

  get recentUrls(): string[] {
    return this.context.workspaceState.get(RemoteRecording.RECENT_REMOTE_URLS) || [];
  }

  addRecentUrl(url: string): void {
    if (url === '') {
      return;
    }

    const { recentUrls } = this;
    if (recentUrls.includes(url)) {
      return;
    }

    this.context.workspaceState.update(RemoteRecording.RECENT_REMOTE_URLS, [...recentUrls, url]);
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
      const statusCode = await RemoteRecordingClient.start(recordingUrl);

      if (statusCode === 409) {
        const stopRecordingText = 'Stop recording';
        const confirmation = await vscode.window.showInformationMessage(
          `Recording is already running on ${recordingUrl}.`,
          stopRecordingText
        );

        if (confirmation === stopRecordingText) {
          this.stop(recordingUrl);
        }

        return;
      }

      this.statusBar.text = `$(circle-record) Recording is running on ${recordingUrl}`;
      this.statusBar.show();

      vscode.window.withProgress(
        {
          cancellable: true,
          location: vscode.ProgressLocation.Notification,
          title: `Recording has started at ${recordingUrl}.`,
        },
        (_progress, token) => {
          return new Promise((_resolve, reject) => {
            token.onCancellationRequested(() => {
              this.commandStopCurrent();
            });

            this.stopEmitter = new vscode.EventEmitter<boolean>();
            this.onDidStop = this.stopEmitter.event;
            this.onDidStop(() => {
              this.stopEmitter?.dispose();
              reject();
            });
          });
        }
      );
      this.onBeginRecording(recordingUrl);
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(
        `Failed to start recording on ${recordingUrl}: ${err.message}`
      );
      return;
    }

    this.addRecentUrl(recordingUrl);
  }

  public async stop(url: string): Promise<boolean> {
    let isFinished = false;
    if (!url) {
      // We'll consider this a valid case - no error is thrown.
      return isFinished;
    }

    const appmapName = await vscode.window.showInputBox({
      placeHolder: 'Enter a name for this AppMap',
    });

    if (!appmapName || appmapName === '') {
      return isFinished;
    }

    try {
      const stopResult = (await RemoteRecordingClient.stop(url)) as {
        statusCode;
        body;
      };

      if (stopResult.statusCode === 404) {
        vscode.window.showInformationMessage(`No recording was running on ${url}.`);
        return isFinished;
      }

      const appmap = stopResult.body;
      appmap['metadata']['name'] = appmapName;

      const folder = await this.getFolder();
      if (!existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

      const fileName = appmapName.replace(/[^a-zA-Z0-9]/g, '_');
      const fileExt = '.appmap.json';
      let checkFileName = fileName;
      let i = 0;

      while (await resolveFilePath(folder, checkFileName + fileExt)) {
        i++;
        checkFileName = `${fileName}(${i})`;
      }

      const filePath = path.join(folder, checkFileName + fileExt);
      await promisify(fs.writeFile)(filePath, JSON.stringify(appmap), 'utf8');

      const uri = vscode.Uri.file(filePath);
      await vscode.commands.executeCommand('vscode.openWith', uri, 'appmap.views.appMapFile');

      vscode.window.showInformationMessage(`Recording successfully stopped at ${url}.`);
      isFinished = true;
      this.stopEmitter?.fire(true);
    } catch (e) {
      const err = e as Error;
      vscode.window.showErrorMessage(`Failed to stop recording: ${err.name}: ${err.message}`);

      const recordingStatus = await this.getStatus(url);
      if (recordingStatus === false) {
        isFinished = true;
      }
    }

    return isFinished;
  }

  private async getStatus(recordingUrl): Promise<boolean | string> {
    try {
      return (await RemoteRecordingClient.getStatus(recordingUrl)) ? 'enabled' : 'disabled';
    } catch (e) {
      return false;
    }
  }

  private async getFolder(): Promise<string> {
    const workspaceFolder = await chooseWorkspace();
    assert(workspaceFolder);
    const basePath = workspaceFolder.uri.fsPath;

    const configManager = this.workspaceServices.getServiceInstanceFromClass(
      AppmapConfigManager,
      workspaceFolder
    ) as AppmapConfigManagerInstance | undefined;
    if (!configManager) return this.findDefaultFolder(basePath);

    const appmapConfig = await configManager.getAppmapConfig();

    let folder: string;
    if (appmapConfig && appmapConfig.appmapDir) {
      folder = path.join(basePath, appmapConfig.appmapDir, 'recordings');
    } else {
      folder = this.findDefaultFolder(basePath);
    }

    return folder;
  }

  private findDefaultFolder(basePath: string): string {
    let folder: string;

    if (existsSync(path.join(basePath, 'build', 'appmap'))) {
      folder = path.join(basePath, 'build', 'appmap', 'recordings');
    } else if (existsSync(path.join(basePath, 'target', 'appmap'))) {
      folder = path.join(basePath, 'target', 'appmap', 'recordings');
    } else {
      folder = path.join(basePath, 'tmp', 'appmap', 'recordings');
    }

    return folder;
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

    if (await this.stop(this.activeRecordingUrl)) {
      this.statusBar.hide();
      this.activeRecordingUrl = null;
      vscode.commands.executeCommand('setContext', 'appmap.recordingIsRunning', false);
    }
  }

  public async commandStatus(): Promise<void> {
    const recordingUrl = await this.getBaseUrl();
    if (recordingUrl === '') {
      return;
    }

    const recordingStatus = await this.getStatus(recordingUrl);

    if (recordingStatus === false) {
      vscode.window.showErrorMessage(
        `Failed to check recording status: can't connect to ${recordingUrl}`
      );
      return;
    }

    const statusMsg =
      recordingStatus == 'enabled'
        ? 'has an active recording in progress'
        : 'is ready to begin recording';

    vscode.window.showInformationMessage(`${recordingUrl} ${statusMsg}.`);
    this.addRecentUrl(recordingUrl);
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

  static async register(
    context: vscode.ExtensionContext,
    workspaceServices: WorkspaceServices
  ): Promise<void> {
    const remoteRecording = new RemoteRecording(context, workspaceServices);

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

  public static resetState(context: vscode.ExtensionContext): void {
    context.workspaceState.update(RemoteRecording.RECENT_REMOTE_URLS, null);
  }
}
