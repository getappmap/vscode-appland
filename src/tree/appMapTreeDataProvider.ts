import * as vscode from 'vscode';
// import { join } from 'path';
import { isDeepStrictEqual } from 'util';
import AppMapCollection from '../services/appmapCollection';
import AppMapLoader from '../services/appmapLoader';
import { AppmapUptodateService } from '../services/appmapUptodateService';
import assert from 'assert';

const LABEL_NO_NAME = 'Untitled AppMap';

// const lightChangedIcon = join(__dirname, '../images/modified-file-icon-dark.svg');
// const darkChangedIcon = join(__dirname, '../images/modified-file-icon-light.svg');

// export interface AppMapsTreeItem {
//   filterAppMaps(appmaps: AppMapLoader[]): AppMapLoader[];
// }

export interface IAppMapTreeItem {
  appmap: AppMapLoader | undefined;

  parent: IAppMapTreeItem | undefined;

  children: IAppMapTreeItem[];
}

class AppMapFolder {
  public name: string;

  constructor(
    protected language: string,
    protected recorderType?: string,
    protected recorderName?: string,
    protected collection?: string
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
      name = `${recorderType[0].toLocaleUpperCase()}${recorderType.slice(
        1
      )} (${language} + ${recorderName})`;
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

class FolderTreeItem extends vscode.TreeItem implements IAppMapTreeItem {
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
      const appmaps = appmapsByFolder.get(key);
      assert(appmaps);
      return new FolderTreeItem(workspaceTreeItem, appmaps.folder, appmaps.appmaps);
    });
  }
}

class AppMapTreeItem extends vscode.TreeItem implements IAppMapTreeItem {
  public children: (IAppMapTreeItem & vscode.TreeItem)[] = [];

  constructor(
    public parent: FolderTreeItem,
    public appmap: AppMapLoader,
    public collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(appmap.descriptor.metadata?.name || LABEL_NO_NAME, collapsibleState);

    this.tooltip = appmap.descriptor.metadata?.name;
    this.iconPath =
      appmap.descriptor.metadata?.test_status === 'failed'
        ? new vscode.ThemeIcon('warning')
        : new vscode.ThemeIcon('file');

    // let iconPath: vscode.ThemeIcon | { light: string; dark: string } = new vscode.ThemeIcon('file');
    // if (!this.isUptodate(element)) iconPath = { light: darkChangedIcon, dark: lightChangedIcon };
    // if (this.isFailed(element)) iconPath = new vscode.ThemeIcon('warning');

    this.command = {
      title: 'Open',
      command: 'vscode.openWith',
      arguments: [this.appmap.descriptor.resourceUri, 'appmap.views.appMapFile'],
    };
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
}

type SortFunction = (a: AppMapLoader, b: AppMapLoader) => number;
type NameFunction = (name: string) => string;

export class AppMapTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private appmaps: AppMapCollection;
  private appmapsUpToDate?: AppmapUptodateService;

  // TreeDataProvider is not Disposable, so we can't dispose of this event emitter.
  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Here you can specify the sort function used for different recording types.
  // Typical choices are alphabetical and chronological.
  static SortMethod: Record<string, SortFunction> = {
    requests: AppMapTreeDataProvider.sortByTimestamp,
    request: AppMapTreeDataProvider.sortByTimestamp,
    remote: AppMapTreeDataProvider.sortByName,
    tests: AppMapTreeDataProvider.sortByName,
  };

  // Here you can specify the name normalize function used for different recording types.
  static NormalizeName: Record<string, NameFunction> = {
    requests: AppMapTreeDataProvider.goodUrlName,
    request: AppMapTreeDataProvider.goodUrlName,
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
    const projectsWithAppMaps = this.appmaps.allAppMaps().reduce((projectsWithAppMaps, appmap) => {
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

  public static folderName(
    language: string,
    recorderType: string,
    recorderName: string,
    collection?: string
  ): string {
    let name: string;
    if (recorderType) {
      name = `${recorderType[0].toLocaleUpperCase()}${recorderType.slice(
        1
      )} (${language} + ${recorderName})`;
    } else {
      name = recorderName;
    }
    const tokens = [name];
    if (collection) {
      tokens.unshift(collection);
    }
    return tokens.join(' - ');
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
