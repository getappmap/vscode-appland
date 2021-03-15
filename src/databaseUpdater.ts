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
    const appmapFolders = ['tmp/appmap', 'tmp/appmap/rspec', 'tmp/appmap/minitest'];
    const folders = vscode.workspace.workspaceFolders;
    if (folders) {
      folders.forEach((wsFolder) => {
        appmapFolders.forEach((folder) => {
          const appmapPattern = new vscode.RelativePattern(wsFolder, `${folder}/*.appmap.json`);
          const watcher = vscode.workspace.createFileSystemWatcher(appmapPattern);
          watcher.onDidChange(this.onChange.bind(this));
          watcher.onDidCreate(this.onCreate.bind(this));
          watcher.onDidDelete(this.onDelete.bind(this));
          context.subscriptions.push(watcher);
        });
      });
    }

    vscode.workspace.findFiles('**/*.appmap.json').then((uris) => {
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
    this.addUri(uri);
  }

  onDelete(uri: vscode.Uri): void {
    console.log(`deleted: ${uri}`);
    this.removeUri(uri);
  }

  get appMapCount(): number {
    return this._appMapCount;
  }

  set appMapCount(count: number) {
    this._appMapCount = count;
    this.statusBarItem.text = `${this._appMapCount} AppMaps`;
  }

  private trackModifiedFile(uri: vscode.Uri) {
    // Don't track or open the "Inventory" file.
    console.log(uri.path);
    console.log(uri.fsPath);
    if (uri.path.match(/\/Inventory\.appmap\.json/)) {
      return;
    }

    this.lastModifiedAppMap = uri;
  }

  private removeUri(uri: vscode.Uri) {
    this.appMapCount -= 1;
    console.log(uri);
  }

  private addUri(uri: vscode.Uri) {
    console.log(uri);
    this.appMapCount += 1;
    /*
    readFile(uri.path, (err, data) => {
      this.appMapCount += 1;
      if (err) {
        return console.error(err);
      }

      const digest = crypto.createHash('sha256').update(data).digest('hex');
      const filename = [digest, 'min', 'appmap'].join('.');
      if (existsSync(filename)) {
        return;
      }

      const appmap = Models.buildAppMap()
        .source(JSON.parse(data.toString()))
        .build();
      const callTree = appmap.callTree.asJSON(appmap.classMap);
      console.log(`Saving to database: ${uri}`)
      callTree._id = uri;
      const base = basename(uri.path);
    });
    */
  }
}
