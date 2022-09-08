import { buildAppMap, Metadata } from '@appland/models';

import * as vscode from 'vscode';

import { AppMapDescriptor } from '../services/appmapLoader';

class AppMapTreeItem extends vscode.TreeItem {
  descriptor?: AppMapDescriptor;
}

interface LiveRecordingMetadata extends Metadata {
  name: string;
  error: boolean;
  unhandledException: boolean;
  queries: Array<string>;
  time: number;
  created: Date;
}

interface LiveRecordingDescriptor {
  data: string;
  metadata: LiveRecordingMetadata;
  resourceUri: vscode.Uri;
}

export const Scheme = `appmap-recording`;

export class LiveRecordingTreeDataProvider
  implements
    vscode.TreeDataProvider<vscode.TreeItem>,
    vscode.Disposable,
    vscode.TextDocumentContentProvider {
  private appmaps: Array<LiveRecordingDescriptor> = [];
  private disposable: vscode.Disposable;

  private _onDidChangeTreeData = new vscode.EventEmitter<undefined>();
  public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor() {
    this.disposable = vscode.workspace.registerTextDocumentContentProvider(Scheme, this);
  }

  provideTextDocumentContent(uri: vscode.Uri): string {
    const index = Number(uri.path.replace(/\.appmap\.json$/, ''));
    const appMap = this.appmaps[this.appmaps.length - 1 - index];
    if (!appMap) {
      throw new Error(`No appmap found at index ${index}`);
    }
    return appMap.data;
  }

  public addAppMap(data: string): void {
    const appmap = buildAppMap(data)
      .normalize()
      .build();

    const rootEvent = appmap.events.find((event) => event.httpServerRequest);
    if (!rootEvent) {
      return;
    }

    const req = rootEvent.httpServerRequest;
    const res = rootEvent.httpServerResponse;
    if (!req || !res) {
      return;
    }

    const path = req.normalized_path_info || req.path_info;
    const metadata = {
      ...appmap.metadata,
      name: `${req.request_method.toUpperCase()} ${path}`,
      error: res.status >= 400,
      unhandledException: rootEvent.exceptions.length > 0,
      queries: appmap.events.filter((event) => event.sql).map((event) => event.sqlQuery as string),
      time: rootEvent.elapsedTime || 0,
      created: new Date(),
    };

    this.appmaps.unshift({
      resourceUri: vscode.Uri.parse([Scheme, this.appmaps.length].join(':'), true),
      metadata,
      data,
    });
    this._onDidChangeTreeData.fire(undefined);
  }

  public clear(): void {
    this.appmaps = [];
    this._onDidChangeTreeData.fire(undefined);
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public getParent(): Thenable<vscode.TreeItem | null> {
    return Promise.resolve(null);
  }

  public getChildren(): Thenable<vscode.TreeItem[]> {
    if (!this.appmaps) {
      return Promise.resolve([]);
    }

    const listItems = this.appmaps.sort().map((appMap) => this.buildTreeItem(appMap));

    return Promise.resolve(listItems);
  }

  protected commandOpenRecordedAppMap;

  protected getIcon(appmap: LiveRecordingMetadata): vscode.ThemeIcon {
    if (appmap.error) {
      return new vscode.ThemeIcon('stop', 'charts.yellow');
    }

    if (appmap.unhandledException) {
      return new vscode.ThemeIcon('flame', 'charts.red');
    }

    return new vscode.ThemeIcon('pass', 'charts.green');
  }

  protected buildTreeItem(appmap: LiveRecordingDescriptor): AppMapTreeItem {
    return {
      iconPath: this.getIcon(appmap.metadata),
      label: appmap.metadata.name,
      tooltip: appmap.metadata.name,
      command: {
        title: 'open',
        command: 'vscode.openWith',
        arguments: [appmap.resourceUri, 'appmap.views.appMapFile'],
      },
      contextValue: 'appmap.views.local.appMap',
      description: appmap.metadata.created.toLocaleTimeString(),
    };
  }

  dispose() {
    this.disposable.dispose();
  }
}
