import * as vscode from 'vscode';
import { promisify } from 'util';
import { readFile } from 'fs';
import ChangeEventDebouncer from './changeEventDebouncer';

const ROOT_ID = '<root>';
const FOLDER = 'folder';
const HTTP = 'http';
const DATABASE = 'database';
const PACKAGE = 'package';
const FUNCTION = 'function';

const betterNames = {
  'database Database': 'Queries',
  'HTTP server request': 'Route',
};

type MinimalCodeObject = CodeObjectEntry | ClassMapEntry;

type ClassMapEntry = {
  folder: vscode.WorkspaceFolder;
  type: string;
  name: string;
  static: boolean;
  labels: string[];
  location?: string;
  children?: ClassMapEntry[];
};

export class CodeObjectEntry {
  private _parent?: CodeObjectEntry;
  private _children: CodeObjectEntry[] = [];
  private childrenByFqid: Map<string, CodeObjectEntry> = new Map();

  constructor(
    public folder: vscode.WorkspaceFolder,
    public fqid: string,
    public type: string,
    public name: string,
    public isStatic = false,
    public labels: Set<string> = new Set(),
    public location?: string
  ) {}

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
          (parent.type === FOLDER && codeObject.type !== FOLDER) ||
          parent.type === HTTP ||
          parent.type === DATABASE
        ) {
          tokens = [];
        } else {
          let separator: string;
          const co = codeObject as any;
          const isStatic = co.static || co.isStatic;
          if (codeObject.type === FUNCTION) {
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
    return new CodeObjectEntry(
      folder,
      fqid,
      cme.type,
      cme.name,
      cme.static,
      new Set(...(cme.labels || [])),
      cme.location
    );
  }

  merge(folder: vscode.WorkspaceFolder, other: ClassMapEntry): void {
    if (other.labels) {
      for (const label of other.labels) {
        this.labels.add(label);
      }
    }

    (other.children || []).forEach(this.findOrMergeChild.bind(this, folder));
  }

  findOrMergeChild(folder: vscode.WorkspaceFolder, cme: ClassMapEntry): CodeObjectEntry {
    const existing = this.children.find((child) => child.name === cme.name);
    if (existing) {
      existing.merge(folder, cme);
      return existing;
    } else {
      const child = CodeObjectEntry.fromClassMapEntry(this, folder, cme);
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
      parent: CodeObjectEntry,
      cme: ClassMapEntry
    ) => {
      const child = parent.findOrMergeChild(folder, cme);
      this._codeObjectByFqid[child.fqid] = child;
      (cme.children || []).forEach(mergeCodeObject.bind(this, folder, child));
    };

    function normalize(cme: ClassMapEntry): ClassMapEntry {
      cme.labels = cme.labels || [];
      cme.children = cme.children || [];
      const betterName = betterNames[[cme.type, cme.name].join(' ')];
      if (betterName) cme.name = betterName;

      if (cme.type === PACKAGE) {
        cme = {
          folder: cme.folder,
          type: FOLDER,
          name: 'Code',
          static: false,
          children: [cme],
          labels: [],
        } as ClassMapEntry;
      }

      return cme;
    }

    const root = new CodeObjectEntry({} as vscode.WorkspaceFolder, ROOT_ID, FOLDER, 'root');
    await Promise.all(
      [...this.classMapFileURLs]
        .map((urlStr) => vscode.Uri.parse(urlStr, true))
        .map(async (classMapFileURL) => {
          const classMapData = await promisify(readFile)(classMapFileURL.fsPath);
          const folder = vscode.workspace.getWorkspaceFolder(classMapFileURL);
          if (!folder) return;

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

          classMap.map(normalize.bind(this)).forEach(mergeCodeObject.bind(this, folder, root));
        })
    );
    return root.children;
  }
}
