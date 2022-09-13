import assert from 'assert';
import { join } from 'path';
import * as vscode from 'vscode';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import { AppMapDescriptor } from '../services/appmapLoader';
import { AppmapUptodateService } from '../services/appmapUptodateService';

const LABEL_NO_NAME = 'Untitled AppMap';

const lightChangedIcon = join(__dirname, '../images/modified-file-icon-dark.svg');
const darkChangedIcon = join(__dirname, '../images/modified-file-icon-light.svg');

class AppMapTreeItem extends vscode.TreeItem {
  descriptor?: AppMapDescriptor;
}

export class AppMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmaps: AppMapCollection;
  private appmapsUpToDate?: AppmapUptodateService;

  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(appmaps: AppMapCollection, appmapsUptodate?: AppmapUptodateService) {
    this.appmaps = appmaps;
    this.appmaps.onUpdated(() => this._onDidChangeTreeData.fire(undefined));
    this.appmapsUpToDate = appmapsUptodate;
    if (this.appmapsUpToDate) {
      this.appmapsUpToDate.onUpdated(() => this._onDidChangeTreeData.fire(undefined));
    }
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!element) {
      return this.getRoots();
    } else {
      const folderName = element.label;
      assert(folderName);
      return this.getAppMapsForRecordingMethod(folderName.toString());
    }
  }

  protected getRoots(): Thenable<vscode.TreeItem[]> {
    const folderNames = new Set<string>();

    this.appmaps
      .appMaps()
      .forEach((appMap) => folderNames.add(AppMapTreeDataProvider.appMapFolderName(appMap)));

    return Promise.resolve(
      [...folderNames].sort().map((name) => ({
        label: name,
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
      }))
    );
  }

  protected static appMapFolderName(appMap: AppMapLoader): string {
    const metadata = appMap.descriptor.metadata as any;
    const recorderType = metadata?.recorder?.type as string | undefined;
    const recorder = metadata?.recorder?.name || 'unknown';
    const language = metadata?.language?.name || 'unknown';
    let name: string;
    if (recorderType && recorderType.length > 1) {
      name = `${recorderType[0].toLocaleUpperCase()}${recorderType.slice(
        1
      )} (${language} + ${recorder})`;
    } else {
      name = recorder;
    }
    return name;
  }

  protected getAppMapsForRecordingMethod(recordingMethod: string): Thenable<vscode.TreeItem[]> {
    if (!this.appmaps) {
      return Promise.resolve([]);
    }

    const listItems = this.appmaps
      .appMaps()
      .filter((appMap) => AppMapTreeDataProvider.appMapFolderName(appMap) === recordingMethod)
      .sort((a, b) => b.descriptor.timestamp - a.descriptor.timestamp)
      .map(this.buildTreeItem.bind(this));

    return Promise.resolve(listItems);
  }

  protected buildTreeItem(appmap: AppMapLoader): AppMapTreeItem {
    const iconPath = this.uptodate(appmap)
      ? new vscode.ThemeIcon('file')
      : { light: darkChangedIcon, dark: lightChangedIcon };

    return {
      iconPath,
      label: (appmap.descriptor.metadata?.name as string) || LABEL_NO_NAME,
      tooltip: (appmap.descriptor.metadata?.name as string) || LABEL_NO_NAME,
      command: {
        title: 'open',
        command: 'vscode.openWith',
        arguments: [appmap.descriptor.resourceUri, 'appmap.views.appMapFile'],
      },
      contextValue: 'appmap.views.local.appMap',
      descriptor: appmap.descriptor,
    };
  }

  protected uptodate(appmap: AppMapLoader): boolean {
    if (!this.appmapsUpToDate) return true;

    return this.appmapsUpToDate.isUpToDate(appmap.descriptor.resourceUri);
  }
}
