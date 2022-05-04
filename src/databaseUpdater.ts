import * as vscode from 'vscode';
import appmapFinder from './appmapFinder';
import appmapWatcher from './appmapWatcher';

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
    appmapWatcher(context, this);
    appmapFinder(this.addUri.bind(this));

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
