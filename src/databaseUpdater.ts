import * as vscode from 'vscode';
/*
import * as crypto from 'crypto';
import * as Models from '@appland/models';
import { existsSync, readFile, writeFile } from 'fs';
import { basename } from 'path';
import { maxHeaderSize } from 'http';
*/

/**
 * Keeps the AppMap database up-to-date.
 */
export class DatabaseUpdater {
  public static register(context: vscode.ExtensionContext): void {
    const showAppMapCountId = 'appmap.showAppMapCount';
    context.subscriptions.push(
      vscode.commands.registerCommand(showAppMapCountId, () => {
        vscode.window.showInformationMessage(`Number of AppMaps: ${updater.appMapCount}`);
      })
    );

    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = showAppMapCountId;
    context.subscriptions.push(statusBarItem);
    const updater = new DatabaseUpdater(statusBarItem);
    updater.initialize(context);

    const command = 'appmap.openMostRecentlyModifiedAppMap';
    const commandHandler = () => {
      if (!updater.lastModifiedAppMap) {
        return;
      }

      vscode.commands.executeCommand('vscode.open', updater.lastModifiedAppMap);
    };

    context.subscriptions.push(vscode.commands.registerCommand(command, commandHandler));
  }

  private _appMapCount: number;
  private statusBarItem: vscode.StatusBarItem;
  public lastModifiedAppMap: vscode.Uri | undefined;

  constructor(statusBarItem: vscode.StatusBarItem) {
    this.statusBarItem = statusBarItem;
    this._appMapCount = 0;
  }

  initialize(context: vscode.ExtensionContext): void {
    const watchers: Record<string, vscode.Disposable> = {};

    const watchFolder = (folder: vscode.WorkspaceFolder) => {
      const appmapPattern = new vscode.RelativePattern(folder, `**/*.appmap.json`);
      const watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
      watcher.onDidChange(this.onChange.bind(this));
      watcher.onDidCreate(this.onCreate.bind(this));
      watcher.onDidDelete(this.onDelete.bind(this));
      watchers[folder.uri.toString()] = watcher;
      context.subscriptions.push(watcher);
    };

    const unwatchFolder = (folder: vscode.WorkspaceFolder) => {
      const watcher = watchers[folder.uri.toString()];
      if (watcher) watcher.dispose();
    };

    vscode.workspace.onDidChangeWorkspaceFolders((e) => {
      e.added.forEach((folder) => {
        console.log(`added folder: ${folder.uri}`);
        watchFolder(folder);
      });
      e.removed.forEach((folder) => {
        console.log(`removed folder: ${folder.uri}`);
        unwatchFolder(folder);
      });
    });

    (vscode.workspace.workspaceFolders || []).forEach(watchFolder);

    vscode.workspace.findFiles('**/*.appmap.json', `**/node_modules/**`).then((uris) => {
      uris.forEach(this.addUri.bind(this));
    });

    this.statusBarItem.show();
  }

  onChange(uri: vscode.Uri): void {
    console.log(`changed: ${uri}`);
    this.trackModifiedFile(uri);
  }

  onCreate(uri: vscode.Uri): void {
    console.log(`created: ${uri}`);
    this.trackModifiedFile(uri);
    this.addUri();
  }

  onDelete(uri: vscode.Uri): void {
    console.log(`deleted: ${uri}`);
    this.removeUri();
  }

  get appMapCount(): number {
    return this._appMapCount;
  }

  set appMapCount(count: number) {
    this._appMapCount = count;
    this.statusBarItem.text = `${this._appMapCount} AppMaps`;
  }

  private trackModifiedFile(uri: vscode.Uri) {
    this.lastModifiedAppMap = uri;
  }

  private removeUri() {
    this.appMapCount -= 1;
  }

  private addUri() {
    this.appMapCount += 1;
  }
}
