import * as vscode from 'vscode';
import { promisify } from 'util';
import { readFile } from 'fs';
import ChangeEventDebouncer from './changeEventDebouncer';
import { Metadata } from '@appland/models';

export enum CodeObjectEntryType {
  ROOT_ID = '<root>',
  FOLDER = 'folder',
  HTTP = 'http',
  ROUTE = 'route',
  DATABASE = 'database',
  QUERY = 'query',
  PACKAGE = 'package',
  CLASS = 'class',
  FUNCTION = 'function',
}

export const InspectableTypes = [
  CodeObjectEntryType.PACKAGE,
  CodeObjectEntryType.CLASS,
  CodeObjectEntryType.FUNCTION,
  CodeObjectEntryType.QUERY,
  CodeObjectEntryType.ROUTE,
];

const betterNames = {
  'database Database': 'Queries',
  'HTTP server request': 'Route',
};

type MinimalCodeObject = CodeObjectEntry | ClassMapEntry;

type ClassMapEntry = {
  folder: vscode.WorkspaceFolder;
  type: CodeObjectEntryType;
  name: string;
  static: boolean;
  labels: string[];
  location?: string;
  children?: ClassMapEntry[];
};

export class CodeObjectEntry {
  private _parent?: CodeObjectEntry;
  private _children: CodeObjectEntry[] = [];
  private _appMapFiles = new Set<string>();
  private childrenByFqid: Map<string, CodeObjectEntry> = new Map();

  constructor(
    public folder: vscode.WorkspaceFolder,
    appMapFilePath: string | undefined,
    public fqid: string,
    public type: CodeObjectEntryType,
    public name: string,
    public isStatic = false,
    public labels: Set<string> = new Set(),
    public path?: string,
    public lineNo?: number
  ) {
    if (appMapFilePath) this._appMapFiles.add(appMapFilePath);
  }

  async collectAppMapMetadata(appMapMetadata: Record<string, Metadata>): Promise<void[]> {
    return Promise.all(
      this.appMapFiles.map(async (file) => {
        if (appMapMetadata[file]) return;

        const metadataFileName = file.replace(/\.appmap\.json$/, '/metadata.json');
        const metadataData = await promisify(readFile)(metadataFileName);
        const metadata = JSON.parse(metadataData.toString()) as Metadata;
        appMapMetadata[file] = metadata;
      })
    );
  }

  async appMapMetadata(): Promise<Record<string, Metadata>> {
    const appMapMetadata: Record<string, Metadata> = {};
    await this.collectAppMapMetadata(appMapMetadata);
    return appMapMetadata;
  }

  get isInspectable(): boolean {
    return InspectableTypes.includes(this.type);
  }

  get appMapFiles(): string[] {
    return [...this._appMapFiles].sort();
  }

  get parent(): CodeObjectEntry | undefined {
    return this._parent;
  }

  set parent(parent: CodeObjectEntry | undefined) {
    this._parent = parent;
  }

  get children(): CodeObjectEntry[] {
    return this._children;
  }

  static fromClassMapEntry(
    parent: CodeObjectEntry,
    folder: vscode.WorkspaceFolder,
    appMapFilePath: string,
    cme: ClassMapEntry
  ): CodeObjectEntry {
    let ancestors: MinimalCodeObject[] = [];
    {
      let ancestor: CodeObjectEntry | undefined = parent;
      while (ancestor) {
        ancestors.push(ancestor);
        ancestor = ancestor.parent;
      }
    }
    ancestors.unshift(cme);
    ancestors = ancestors.reverse();

    let tokens: string[] = [];
    ancestors.forEach((codeObject, index) => {
      let parent: MinimalCodeObject | undefined;
      if (index > 0) parent = ancestors[index - 1];

      if (parent) {
        if (
          (parent.type === CodeObjectEntryType.FOLDER &&
            codeObject.type !== CodeObjectEntryType.FOLDER) ||
          parent.type === CodeObjectEntryType.HTTP ||
          parent.type === CodeObjectEntryType.DATABASE
        ) {
          tokens = [];
        } else {
          let separator: string;
          const co = codeObject as any;
          const isStatic = co.static || co.isStatic;
          if (codeObject.type === CodeObjectEntryType.FUNCTION) {
            separator = isStatic ? '.' : '#';
          } else {
            separator = CodeObjectEntry.separator(parent.type);
          }
          tokens.push(separator);
        }
      }
      tokens.push(codeObject.name);
    });

    const fqid = [cme.type, tokens.join('')].join(':');
    let path: string | undefined, lineNo: string | undefined;
    if (cme.location) {
      [path, lineNo] = cme.location.split(':');
    }
    return new CodeObjectEntry(
      folder,
      appMapFilePath,
      fqid,
      cme.type,
      cme.name,
      cme.static,
      new Set(...(cme.labels || [])),
      path,
      lineNo ? parseInt(lineNo) : undefined
    );
  }

  merge(folder: vscode.WorkspaceFolder, appMapFilePath: string, other: ClassMapEntry): void {
    if (other.labels) {
      for (const label of other.labels) {
        this.labels.add(label);
      }
    }
    this._appMapFiles.add(appMapFilePath);

    (other.children || []).forEach(this.findOrMergeChild.bind(this, folder, appMapFilePath));
  }

  findOrMergeChild(
    folder: vscode.WorkspaceFolder,
    appMapFilePath: string,
    cme: ClassMapEntry
  ): CodeObjectEntry {
    const existing = this.children.find((child) => child.name === cme.name);
    if (existing) {
      existing.merge(folder, appMapFilePath, cme);
      return existing;
    } else {
      const child = CodeObjectEntry.fromClassMapEntry(this, folder, appMapFilePath, cme);
      this.children.push(child);
      child.parent = this;
      this.childrenByFqid.set(child.fqid, child);
      return child;
    }
  }

  static separator(type: string): string {
    let separator: string;
    switch (type) {
      case 'package':
        separator = '/';
        break;
      case 'class':
        separator = '::';
        break;
      default:
        separator = '->';
    }
    return separator;
  }
}

export default class ClassMapIndex {
  private _onChanged = new ChangeEventDebouncer<ClassMapIndex>();
  public readonly onChanged = this._onChanged.event;

  private classMapFileURLs = new Set<string>();
  private _dirty = true;
  private _classMap: CodeObjectEntry[] = [];
  private _codeObjectByFqid: Record<string, CodeObjectEntry> = {};

  async lookupCodeObject(fqid: string): Promise<CodeObjectEntry | undefined> {
    await this.updateClassMap();

    return this._codeObjectByFqid[fqid];
  }

  async classMap(): Promise<CodeObjectEntry[]> {
    await this.updateClassMap();

    return this._classMap;
  }

  addClassMapFile(sourceUri: vscode.Uri): void {
    console.log(`ClassMap file added: ${sourceUri.fsPath}`);

    const folder = vscode.workspace.getWorkspaceFolder(sourceUri);
    if (!folder) return;

    this._dirty = true;
    this.classMapFileURLs.add(sourceUri.toString());
    this._onChanged.fire(this);
  }

  removeClassMapFile(sourceUri: vscode.Uri): void {
    console.log(`ClassMap file removed: ${sourceUri.fsPath}`);

    this._dirty = true;
    this.classMapFileURLs.delete(sourceUri.toString());
    this._onChanged.fire(this);
  }

  protected async updateClassMap(): Promise<void> {
    if (this._dirty) {
      this._dirty = false;
      this._codeObjectByFqid = {};
      this._classMap = await this.buildClassMap();
    }
  }

  protected async buildClassMap(): Promise<CodeObjectEntry[]> {
    const mergeCodeObject = (
      folder: vscode.WorkspaceFolder,
      appMapFilePath: string,
      parent: CodeObjectEntry,
      cme: ClassMapEntry
    ) => {
      const child = parent.findOrMergeChild(folder, appMapFilePath, cme);
      this._codeObjectByFqid[child.fqid] = child;
      (cme.children || []).forEach(mergeCodeObject.bind(this, folder, appMapFilePath, child));
    };

    function normalizeRoot(cme: ClassMapEntry): ClassMapEntry {
      cme.labels = cme.labels || [];
      cme.children = cme.children || [];
      const betterName = betterNames[[cme.type, cme.name].join(' ')];
      if (betterName) cme.name = betterName;

      let result = cme;
      if (cme.type === CodeObjectEntryType.PACKAGE) {
        {
          // Some code object entries have a path-delimited package name, but we want
          // each package name token to be its own object.
          const chain = cme.name.split('/').map(
            (name: string) =>
              ({
                folder: cme.folder,
                type: cme.type,
                name: name,
                static: cme.static,
                location: cme.location,
                children: [],
                labels: cme.labels,
              } as ClassMapEntry)
          );
          chain.forEach((item, index) => {
            if (index > 0) {
              chain[index - 1].children = [item];
            }
          });
          chain[chain.length - 1].children = cme.children;
          cme = chain[0];
        }

        result = {
          folder: cme.folder,
          type: CodeObjectEntryType.FOLDER,
          name: 'Code',
          static: false,
          location: cme.location,
          children: [cme],
          labels: [],
        } as ClassMapEntry;
      }

      return result;
    }

    const root = new CodeObjectEntry(
      {} as vscode.WorkspaceFolder,
      undefined,
      CodeObjectEntryType.ROOT_ID,
      CodeObjectEntryType.FOLDER,
      'root'
    );
    await Promise.all(
      [...this.classMapFileURLs]
        .map((urlStr) => vscode.Uri.parse(urlStr, true))
        .map(async (classMapFileURL) => {
          let classMapData: Buffer;
          try {
            classMapData = await promisify(readFile)(classMapFileURL.fsPath);
          } catch (e) {
            console.warn(e);
            return;
          }

          const folder = vscode.workspace.getWorkspaceFolder(classMapFileURL);
          if (!folder) {
            console.warn(`No workspace folder for ${classMapFileURL.fsPath}`);
            return;
          }

          let classMap: ClassMapEntry[];
          try {
            classMap = JSON.parse(classMapData.toString());
          } catch (e) {
            // Malformed JSON file. This is logged because classMap files should be written atomically.
            console.warn(e);
            return;
          }

          if (!classMap) {
            console.log(`ClassMap from ${classMapFileURL} is falsey`);
            return;
          }

          const classMapFileTokens = classMapFileURL.fsPath.split('/');
          classMapFileTokens.pop();
          const indexDir = classMapFileTokens.join('/');
          const appMapFilePath = [indexDir, 'appmap.json'].join('.');
          classMap
            .map(normalizeRoot.bind(this))
            .forEach(mergeCodeObject.bind(this, folder, appMapFilePath, root));
        })
    );
    return root.children;
  }
}
