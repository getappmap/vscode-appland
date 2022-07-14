import * as vscode from 'vscode';
import { promisify } from 'util';
import { readFile } from 'fs';
import { Metadata } from '@appland/models';

export enum CodeObjectEntryRootType {
  HTTP = 'http',
  FOLDER = 'folder',
  DATABASE = 'database',
  PACKAGE = 'package',
}

export enum CodeObjectEntryChildType {
  ROUTE = 'route',
  QUERY = 'query',
  CLASS = 'class',
  FUNCTION = 'function',
}

export const InspectableTypes = [
  CodeObjectEntryRootType.PACKAGE,
  CodeObjectEntryChildType.CLASS,
  CodeObjectEntryChildType.FUNCTION,
  CodeObjectEntryChildType.QUERY,
  CodeObjectEntryChildType.ROUTE,
];

export type MinimalCodeObject = CodeObjectEntry | ClassMapEntry;

export type ClassMapEntry = {
  folder: vscode.WorkspaceFolder;
  type: CodeObjectEntryRootType | CodeObjectEntryChildType;
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
    public type: CodeObjectEntryRootType | CodeObjectEntryChildType,
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
          (parent.type === CodeObjectEntryRootType.FOLDER &&
            codeObject.type !== CodeObjectEntryRootType.FOLDER) ||
          parent.type === CodeObjectEntryRootType.HTTP ||
          parent.type === CodeObjectEntryRootType.DATABASE
        ) {
          tokens = [];
        } else {
          let separator: string;
          const co = codeObject as any; // eslint-disable-line @typescript-eslint/no-explicit-any
          const isStatic = co.static || co.isStatic;
          if (codeObject.type === CodeObjectEntryChildType.FUNCTION) {
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

  merge(appMapFilePath: string, other: ClassMapEntry): void {
    if (other.labels) {
      for (const label of other.labels) {
        this.labels.add(label);
      }
    }
    this._appMapFiles.add(appMapFilePath);
  }

  findOrMergeChild(
    folder: vscode.WorkspaceFolder,
    appMapFilePath: string,
    cme: ClassMapEntry
  ): CodeObjectEntry {
    const existing = this.children.find((child) => child.name === cme.name);
    if (existing) {
      existing.merge(appMapFilePath, cme);
      return existing;
    } else {
      const child = CodeObjectEntry.fromClassMapEntry(this, folder, appMapFilePath, cme);
      this.children.push(child);
      child.parent = this;
      this.childrenByFqid.set(child.fqid, child);
      return child;
    }
  }

  finalize(): void {
    this._children = this._children.sort((a, b) => a.fqid.localeCompare(b.fqid));
    this._children.forEach((child) => child.finalize());
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
