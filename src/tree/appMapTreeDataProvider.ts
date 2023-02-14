import * as vscode from 'vscode';
import { join } from 'path';
import { isDeepStrictEqual } from 'util';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import { AppMapDescriptor } from '../services/appmapLoader';
import { AppmapUptodateService } from '../services/appmapUptodateService';

const LABEL_NO_NAME = 'Untitled AppMap';

const lightChangedIcon = join(__dirname, '../images/modified-file-icon-dark.svg');
const darkChangedIcon = join(__dirname, '../images/modified-file-icon-light.svg');

export type AppMapTreeItem = vscode.TreeItem & {
  descriptor: AppMapDescriptor;
};

export type RootTreeItem = vscode.TreeItem & {
  folderProperties: FolderProperties;
};

class FolderProperties {
  constructor(
    public recorderName: string,
    public recorderType?: string,
    public language?: string,
    public collection?: string
  ) {}
}

type SortFunction = (a: AppMapLoader, b: AppMapLoader) => number;
type NameFunction = (name: string) => string;

export class AppMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmaps: AppMapCollection;
  private appmapsUpToDate?: AppmapUptodateService;

  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Here you can specify the sort function used for different recording types.
  // Typical choices are alphabetical and chronological.
  static SortMethod: Record<string, SortFunction> = {
    requests: AppMapTreeDataProvider.sortByTimestamp,
    remote: AppMapTreeDataProvider.sortByName,
    tests: AppMapTreeDataProvider.sortByName,
  };

  // Here you can specify the name normalize function used for different recording types.
  static NormalizeName: Record<string, NameFunction> = {
    requests: AppMapTreeDataProvider.goodUrlName,
    remote: AppMapTreeDataProvider.identityName,
    tests: AppMapTreeDataProvider.identityName,
  };

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
      const folderProperties = (element as RootTreeItem).folderProperties;
      return this.getAppMapsForRecordingMethod(folderProperties);
    }
  }

  protected getRoots(): Thenable<RootTreeItem[]> {
    const folderNames = new Set<string>();
    const folderProperties = new Map<string, FolderProperties>();

    this.appmaps.appMaps().forEach((appMap) => {
      const properties = AppMapTreeDataProvider.appMapFolderProperties(appMap);
      const folderName = AppMapTreeDataProvider.folderName(properties);
      if (!folderNames.has(folderName)) {
        folderProperties.set(folderName, properties);
      }
      folderNames.add(folderName);
    });

    return Promise.resolve(
      [...folderNames].sort().map(
        (name) =>
          ({
            label: name,
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            folderProperties: folderProperties.get(name),
            contextValue: 'appmap.views.local.appMapCollection',
          } as RootTreeItem)
      )
    );
  }

  protected static sortByTimestamp(a: AppMapLoader, b: AppMapLoader): number {
    return b.descriptor.timestamp - a.descriptor.timestamp;
  }

  protected static sortByName(a: AppMapLoader, b: AppMapLoader): number {
    const aName = (a.descriptor.metadata?.name as string) || LABEL_NO_NAME;
    const bName = (b.descriptor.metadata?.name as string) || LABEL_NO_NAME;
    return aName.localeCompare(bName);
  }

  protected static identityName(name: string): string {
    return name;
  }

  // Double forward slashes are sometimes observed in URL paths and they make it into the AppMap name.
  protected static goodUrlName(name: string): string {
    return name.replace(/\/{2,}/g, '/');
  }

  public static folderName(properties: FolderProperties): string {
    let name: string;
    if (properties.recorderType && properties.recorderType.length > 1) {
      name = `${properties.recorderType[0].toLocaleUpperCase()}${properties.recorderType.slice(
        1
      )} (${properties.language} + ${properties.recorderName})`;
    } else {
      name = properties.recorderName;
    }
    const tokens = [name];
    if (properties.collection) {
      tokens.unshift(properties.collection);
    }
    return tokens.join(' - ');
  }

  public static appMapFolderProperties(appMap: AppMapLoader): FolderProperties {
    const metadata = appMap.descriptor.metadata;

    const name = metadata?.recorder?.name;
    const type = metadata?.recorder?.type;
    const language = metadata?.language?.name;
    const collection = metadata?.collection;
    return new FolderProperties(name || 'unknown recorder', type, language, collection);
  }

  protected getAppMapsForRecordingMethod(
    folderProperties: FolderProperties
  ): Thenable<vscode.TreeItem[]> {
    if (!this.appmaps) {
      return Promise.resolve([]);
    }

    const sortFunction =
      AppMapTreeDataProvider.SortMethod[folderProperties.recorderType || 'unknown recorder type'] ||
      AppMapTreeDataProvider.sortByName;
    const nameFunction =
      AppMapTreeDataProvider.NormalizeName[
        folderProperties.recorderType || 'unknown recorder type'
      ] || AppMapTreeDataProvider.identityName;
    const listItems = this.appmaps
      .appMaps()
      .filter((appMap) =>
        isDeepStrictEqual(AppMapTreeDataProvider.appMapFolderProperties(appMap), folderProperties)
      )
      .map((appmap) => {
        if (appmap.descriptor.metadata)
          appmap.descriptor.metadata.name = nameFunction(appmap.descriptor.metadata.name as string);
        return appmap;
      })
      .sort(sortFunction)
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
