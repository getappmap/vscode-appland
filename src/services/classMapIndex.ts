import * as vscode from 'vscode';
import { promisify } from 'util';
import { readFile } from 'fs';

const betterNames = {
  'database Database': 'Queries',
  'HTTP HTTP server request': 'Route',
};

type ClassMapEntry = {
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

  get children(): CodeObjectEntry[] {
    return this._children;
  }

  static fromClassMapEntry(parent: CodeObjectEntry, cme: ClassMapEntry): CodeObjectEntry {
    const names = [cme.name];
    let ancestor: CodeObjectEntry | undefined = parent;
    while (ancestor) {
      names.push(ancestor.name);
      ancestor = ancestor.parent;
    }
    const fqid = [cme.type, names.reverse().join('.'), cme.static ? '?static' : undefined]
      .filter(Boolean)
      .join(':');

    return new CodeObjectEntry(
      fqid,
      cme.type,
      cme.name,
      cme.static,
      new Set(...(cme.labels || [])),
      cme.location
    );
  }

  merge(other: ClassMapEntry): void {
    if (other.labels) {
      for (const label of other.labels) {
        this.labels.add(label);
      }
    }

    (other.children || []).forEach(this.findOrMergeChild.bind(this));
  }

  findOrMergeChild(cme: ClassMapEntry): CodeObjectEntry {
    const existing = this.children.find((child) => child.name === cme.name);
    if (existing) {
      existing.merge(cme);
      return existing;
    } else {
      const child = CodeObjectEntry.fromClassMapEntry(this, cme);
      this.children.push(child);
      this.childrenByFqid.set(child.fqid, child);
      return child;
    }
  }
}

export default class ClassMapIndex {
  private _onChanged = new vscode.EventEmitter<vscode.Uri>();
  public readonly onChanged = this._onChanged.event;

  private classMapFiles = new Set<string>();
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

    if (!this.classMapFiles.has(sourceUri.fsPath)) {
      this._dirty = true;
      this.classMapFiles.add(sourceUri.fsPath);
      this._onChanged.fire(sourceUri);
    }
  }

  removeClassMapFile(sourceUri: vscode.Uri): void {
    console.log(`ClassMap file removed: ${sourceUri.fsPath}`);

    if (this.classMapFiles.has(sourceUri.fsPath)) {
      this._dirty = true;
      this.classMapFiles.delete(sourceUri.fsPath);
      this._onChanged.fire(sourceUri);
    }
  }

  protected async updateClassMap(): Promise<void> {
    if (this._dirty) {
      this._dirty = false;
      this._codeObjectByFqid = {};
      this._classMap = await this.buildClassMap();
    }
  }

  protected async buildClassMap(): Promise<CodeObjectEntry[]> {
    const mergeCodeObject = (parent: CodeObjectEntry, cme: ClassMapEntry) => {
      const child = parent.findOrMergeChild(cme);
      this._codeObjectByFqid[child.fqid] = child;
      (cme.children || []).forEach(mergeCodeObject.bind(this, child));
    };

    function normalize(cme: ClassMapEntry): ClassMapEntry {
      cme.labels = cme.labels || [];
      cme.children = cme.children || [];
      const betterName = betterNames[[cme.type, cme.name].join(' ')];
      if (betterName) cme.name = betterName;

      if (cme.type === 'package') {
        cme = {
          type: 'code',
          name: 'Code',
          static: false,
          children: [cme],
          labels: [],
        } as ClassMapEntry;
      }

      return cme;
    }

    const root = new CodeObjectEntry('root', 'root', 'root');
    for (const classMapFile of this.classMapFiles) {
      const classMapData = await promisify(readFile)(classMapFile);
      let classMap: ClassMapEntry[];
      try {
        classMap = JSON.parse(classMapData.toString());
      } catch (e) {
        // Malformed JSON file. This is logged because classMap files should be written atomically.
        console.warn(e);
        continue;
      }

      if (!classMap) {
        console.log(`ClassMap from ${classMapFile} is falsey`);
        continue;
      }

      classMap.map(normalize).forEach(mergeCodeObject.bind(this, root));
    }
    return root.children;
  }
}
