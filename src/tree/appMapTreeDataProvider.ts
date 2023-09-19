import * as vscode from 'vscode';
import { join } from 'path';
import { isDeepStrictEqual } from 'util';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import { AppmapUptodateService } from '../services/appmapUptodateService';
import uniq from '../lib/uniq';

const LABEL_NO_NAME = 'Untitled AppMap';

const lightChangedIcon = join(__dirname, '../images/modified-file-icon-dark.svg');
const darkChangedIcon = join(__dirname, '../images/modified-file-icon-light.svg');

class WorkspaceFolderAppMapTreeItem extends vscode.TreeItem {
  name: string;

  constructor(public folder: vscode.WorkspaceFolder) {
    super(folder.name, vscode.TreeItemCollapsibleState.Expanded);
    this.name = folder.name;
  }

  filterAppMaps(appmaps: AppMapLoader[]): AppMapLoader[] {
    return appmaps.filter((appmap) =>
      appmap.descriptor.resourceUri.fsPath.startsWith(this.folder.uri.fsPath)
    );
  }
}

export interface FolderProperties {
  recorderName: string;
  recorderType?: string;
  language?: string;
  collection?: string;
}

export type FolderItem = FolderProperties & { name: string };

export type AppMapTreeItem = AppMapLoader | FolderItem | WorkspaceFolderAppMapTreeItem;

function isAppMapLoader(item: AppMapTreeItem): item is AppMapLoader {
  return 'descriptor' in item;
}

type SortFunction = (a: AppMapLoader, b: AppMapLoader) => number;
type NameFunction = (name: string) => string;

export class AppMapTreeDataProvider implements vscode.TreeDataProvider<AppMapTreeItem> {
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

  public getTreeItem(element: AppMapTreeItem): vscode.TreeItem {
    if (isAppMapLoader(element)) {
      let iconPath: vscode.ThemeIcon | { light: string; dark: string } = new vscode.ThemeIcon(
        'file'
      );
      if (!this.isUptodate(element)) iconPath = { light: darkChangedIcon, dark: lightChangedIcon };
      if (this.isFailed(element)) iconPath = new vscode.ThemeIcon('warning');

      const { descriptor } = element;

      return {
        iconPath,
        label: descriptor.metadata?.name || LABEL_NO_NAME,
        tooltip: element.descriptor.metadata?.name || LABEL_NO_NAME,
        command: {
          title: 'Open',
          command: 'vscode.openWith',
          arguments: [descriptor.resourceUri, 'appmap.views.appMapFile'],
        },
        contextValue: 'appmap.views.appmaps.appMap',
      };
    } else {
      return {
        label: element.name,
        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
        contextValue: 'appmap.views.appmaps.appMapCollection',
      };
    }
  }

  public getChildren(): FolderItem[];
  public getChildren(element: FolderItem): AppMapLoader[];
  public getChildren(element: AppMapLoader): [];
  public getChildren(element?: AppMapTreeItem): AppMapTreeItem[] {
    if (!element) {
      return this.getTopLevelTreeItems();
    } else if (element instanceof WorkspaceFolderAppMapTreeItem) {
      return this.getRoots(element);
    } else {
      if (isAppMapLoader(element)) return [];
      return this.getAppMapsForRecordingMethod(element);
    }
  }

  private getTopLevelTreeItems() {
    const projects = vscode.workspace.workspaceFolders;
    if (!projects || this.appmaps.appMaps().length === 0) return [];
    const projectsWithAppMaps = this.appmaps.allAppMaps().reduce((projectsWithAppMaps, appmap) => {
      const project = projects.find((project) =>
        appmap.descriptor.resourceUri.fsPath.startsWith(project.uri.fsPath)
      );
      if (project) projectsWithAppMaps.add(project);
      return projectsWithAppMaps;
    }, new Set<vscode.WorkspaceFolder>());

    return [...projectsWithAppMaps.values()].map(
      (project) => new WorkspaceFolderAppMapTreeItem(project)
    );
  }

  protected getRoots(element: WorkspaceFolderAppMapTreeItem): FolderItem[] {
    const items = element
      .filterAppMaps(this.appmaps.allAppMaps())
      .map(AppMapTreeDataProvider.appMapFolderItems);
    return uniq(items, ({ name }) => name, true);
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

  public static appMapFolderItems(appMap: AppMapLoader): FolderItem {
    const { metadata } = appMap.descriptor;

    const props: FolderProperties = {
      collection: metadata?.collection,
      language: metadata?.language?.name,
      recorderName: metadata?.recorder?.name || 'unknown recorder',
      recorderType: metadata?.recorder?.type,
    };

    return { name: AppMapTreeDataProvider.folderName(props), ...props };
  }

  protected getAppMapsForRecordingMethod(folderProperties: FolderProperties): AppMapLoader[] {
    if (!this.appmaps) [];

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
        isDeepStrictEqual(AppMapTreeDataProvider.appMapFolderItems(appMap), folderProperties)
      )
      .map((appmap) => {
        if (appmap.descriptor.metadata)
          appmap.descriptor.metadata.name = nameFunction(appmap.descriptor.metadata.name as string);
        return appmap;
      })
      .sort(sortFunction);

    return listItems;
  }

  protected isFailed(appmap: AppMapLoader): boolean {
    return appmap.descriptor.metadata?.test_status === 'failed';
  }

  protected isUptodate(appmap: AppMapLoader): boolean {
    if (!this.appmapsUpToDate) return true;

    return this.appmapsUpToDate.isUpToDate(appmap.descriptor.resourceUri);
  }

  // This method has to be defined to use TreeView.reveal().
  // Implementing this only for the root element, because we are
  // "reveal"ing the root in the appmap.view.focusAppMaps command.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/naming-convention
  getParent(element: AppMapTreeItem): vscode.ProviderResult<AppMapTreeItem> {
    return undefined;
  }
}
