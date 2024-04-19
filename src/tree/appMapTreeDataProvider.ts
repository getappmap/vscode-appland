import * as vscode from 'vscode';
import { join } from 'path';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import { AppmapUptodateService } from '../services/appmapUptodateService';
import assert from 'assert';
import { warn } from 'console';

const LABEL_NO_NAME = 'Untitled AppMap';

// const lightChangedIcon = join(__dirname, '../images/modified-file-icon-dark.svg');
// const darkChangedIcon = join(__dirname, '../images/modified-file-icon-light.svg');

export interface IAppMapTreeItem {
  appmap: AppMapLoader | undefined;

  parent: (vscode.TreeItem & IAppMapTreeItem) | undefined;

  children: (vscode.TreeItem & IAppMapTreeItem)[];
}

class AppMapFolder {
  public name: string;

  constructor(
    public language: string,
    public recorderType?: string,
    public recorderName?: string,
    public collection?: string
  ) {
    this.name = AppMapFolder.folderName(language, recorderType, recorderName, collection);
  }

  static folderName(
    language: string,
    recorderType?: string,
    recorderName?: string,
    collection?: string
  ): string {
    let name: string;
    if (recorderType && recorderType.length > 1) {
      const baseName = `${recorderType[0].toLocaleUpperCase()}${recorderType.slice(1)}`;
      const descriptorName = [language, recorderName].filter(Boolean).join(' + ');
      const tokens = [baseName];
      if (descriptorName) tokens.push(`(${descriptorName})`);
      name = tokens.join(' ');
    } else if (recorderName) {
      name = recorderName;
    } else {
      name = language;
    }
    const tokens = [name];
    if (collection) {
      tokens.unshift(collection);
    }
    return tokens.join(' - ');
  }

  static fromAppMap(appmap: AppMapLoader): AppMapFolder {
    const { metadata } = appmap.descriptor;

    return new AppMapFolder(
      metadata?.language?.name || 'unspecified language',
      metadata?.recorder?.type,
      metadata?.recorder?.name,
      metadata?.collection
    );
  }
}

class WorkspaceTreeItem extends vscode.TreeItem implements IAppMapTreeItem {
  public name: string;
  public appmap: AppMapLoader | undefined = undefined;
  public children: (IAppMapTreeItem & vscode.TreeItem)[];

  constructor(public folder: vscode.WorkspaceFolder, appmaps: AppMapLoader[]) {
    super(folder.name, vscode.TreeItemCollapsibleState.Expanded);

    this.name = folder.name;
    this.contextValue = 'appmap.views.appmaps.appMapCollection';
    this.children = FolderTreeItem.buildFolderTreeItems(this, appmaps);
  }

  get parent(): undefined {
    return;
  }

  filterAppMaps(appmaps: AppMapLoader[]): AppMapLoader[] {
    return appmaps.filter((appmap) =>
      appmap.descriptor.resourceUri.fsPath.startsWith(this.folder.uri.fsPath)
    );
  }
}

type SortFunction = (a: AppMapLoader, b: AppMapLoader) => number;
type NameFunction = (name: string) => string;

class FolderTreeItem extends vscode.TreeItem implements IAppMapTreeItem {
  // Here you can specify the sort function used for different recording types.
  // Typical choices are alphabetical and chronological.
  static SortMethod: Record<string, SortFunction> = {
    requests: FolderTreeItem.sortByTimestamp,
    request: FolderTreeItem.sortByTimestamp,
    remote: FolderTreeItem.sortByName,
    tests: FolderTreeItem.sortByName,
  };

  public children: (IAppMapTreeItem & vscode.TreeItem)[];
  public appmap: AppMapLoader | undefined = undefined;

  constructor(
    public parent: WorkspaceTreeItem,
    public folder: AppMapFolder,
    appmaps: AppMapLoader[]
  ) {
    super(folder.name, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = 'appmap.views.appmaps.appMapCollection';
    this.children = AppMapTreeItem.buildAppMapTreeItems(this, appmaps);
  }

  static buildFolderTreeItems(
    workspaceTreeItem: WorkspaceTreeItem,
    appmaps: AppMapLoader[]
  ): FolderTreeItem[] {
    const appmapsByFolder = appmaps.reduce((appmapsByFolder, appmap) => {
      const folder = AppMapFolder.fromAppMap(appmap);
      const { name } = folder;
      if (!appmapsByFolder.has(name)) {
        appmapsByFolder.set(name, { folder, appmaps: [] });
      }
      appmapsByFolder.get(name)?.appmaps.push(appmap);
      return appmapsByFolder;
    }, new Map<string, { folder: AppMapFolder; appmaps: AppMapLoader[] }>());
    return [...appmapsByFolder.keys()].sort().map((key) => {
      const folderContent = appmapsByFolder.get(key);
      assert(folderContent);

      let { recorderType } = folderContent.folder;
      if (!recorderType) recorderType = 'unknown recorder type';
      const sortFunction = FolderTreeItem.SortMethod[recorderType] || FolderTreeItem.sortByName;
      folderContent.appmaps.sort(sortFunction);

      return new FolderTreeItem(workspaceTreeItem, folderContent.folder, folderContent.appmaps);
    });
  }

  protected static sortByTimestamp(a: AppMapLoader, b: AppMapLoader): number {
    return b.descriptor.timestamp - a.descriptor.timestamp;
  }

  protected static sortByName(a: AppMapLoader, b: AppMapLoader): number {
    const aName = (a.descriptor.metadata?.name as string) || LABEL_NO_NAME;
    const bName = (b.descriptor.metadata?.name as string) || LABEL_NO_NAME;
    return aName.localeCompare(bName);
  }
}

class AppMapTreeItem extends vscode.TreeItem implements IAppMapTreeItem {
  public children: (IAppMapTreeItem & vscode.TreeItem)[] = [];

  constructor(
    public parent: FolderTreeItem,
    public appmap: AppMapLoader,
    public collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(
      AppMapTreeItem.normalizeName(
        appmap.descriptor.metadata?.name || LABEL_NO_NAME,
        appmap.descriptor.metadata?.recorder?.type || 'undefined'
      ),
      collapsibleState
    );

    const isFailed = appmap.descriptor.metadata?.test_status === 'failed';

    let iconPath: vscode.ThemeIcon | { light: string; dark: string };
    if (isFailed) iconPath = new vscode.ThemeIcon('warning');
    // TODO :Revive
    // else if (!this.isUptodate(element)) iconPath = { light: darkChangedIcon, dark: lightChangedIcon };
    else iconPath = new vscode.ThemeIcon('file');

    this.command = {
      title: 'Open',
      command: 'vscode.openWith',
      arguments: [this.appmap.descriptor.resourceUri, 'appmap.views.appMapFile'],
    };
    this.tooltip = appmap.descriptor.metadata?.name;
    this.iconPath = iconPath;
    this.contextValue = 'appmap.views.appmaps.appMap';
  }

  static buildAppMapTreeItems(
    folderTreeItem: FolderTreeItem,
    appmaps: AppMapLoader[]
  ): AppMapTreeItem[] {
    return appmaps.map((appmap) => {
      return new AppMapTreeItem(folderTreeItem, appmap, vscode.TreeItemCollapsibleState.None);
    });
  }

  // Here you can specify the name normalize function used for different recording types.
  static NormalizeName: Record<string, NameFunction> = {
    requests: AppMapTreeItem.goodUrlName,
    request: AppMapTreeItem.goodUrlName,
    remote: AppMapTreeItem.identityName,
    tests: AppMapTreeItem.identityName,
  };

  protected static normalizeName(name: string, recorderType: string): string {
    const normalizeFn = AppMapTreeItem.NormalizeName[recorderType] || AppMapTreeItem.identityName;
    return normalizeFn(name);
  }

  protected static identityName(name: string): string {
    return name;
  }

  // Double forward slashes are sometimes observed in URL paths and they make it into the AppMap name.
  protected static goodUrlName(name: string): string {
    return name.replace(/\/{2,}/g, '/');
  }
}

export class AppMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmaps: AppMapCollection;
  private appmapsUpToDate?: AppmapUptodateService;

  // TreeDataProvider is not Disposable, so we can't dispose of this event emitter.
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

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
    if (!element) {
      return this.getTopLevelTreeItems();
    } else if (element instanceof WorkspaceTreeItem) {
      return element.children;
    } else if (element instanceof FolderTreeItem) {
      return element.children;
    } else {
      return [];
    }
  }

  private getTopLevelTreeItems() {
    const projects = vscode.workspace.workspaceFolders;
    if (!projects || this.appmaps.appMaps().length === 0) return [];

    const appmapsByProject = new Map<vscode.WorkspaceFolder, AppMapLoader[]>();
    const projectsWithAppMaps = this.appmaps.appMaps().reduce((projectsWithAppMaps, appmap) => {
      const project = projects.find((project) =>
        appmap.descriptor.resourceUri.fsPath.startsWith(project.uri.fsPath)
      );
      if (project) {
        projectsWithAppMaps.add(project);
        if (!appmapsByProject.has(project)) {
          appmapsByProject.set(project, []);
        }
        appmapsByProject.get(project)?.push(appmap);
      }
      return projectsWithAppMaps;
    }, new Set<vscode.WorkspaceFolder>());

    return [...projectsWithAppMaps.values()].map(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      (project) => new WorkspaceTreeItem(project, appmapsByProject.get(project)!)
    );
  }

  protected isUptodate(appmap: AppMapLoader): boolean {
    if (!this.appmapsUpToDate) return true;

    return this.appmapsUpToDate.isUpToDate(appmap.descriptor.resourceUri);
  }

  getParent(element: AppMapTreeItem): vscode.ProviderResult<vscode.TreeItem & IAppMapTreeItem> {
    return element.parent;
  }
}
