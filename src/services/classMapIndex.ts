import * as vscode from 'vscode';
import ChangeEventDebouncer from './changeEventDebouncer';
import backgroundJob from '../lib/backgroundJob';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';
import { buildClassMap } from '../lib/buildClassMap';

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

  clear(): void {
    this._dirty = false;
    this.classMapFileURLs = new Set<string>();
    this._classMap = [];
    this._codeObjectByFqid = {};
    this._onChanged.fire(this);
  }

  async classMap(): Promise<CodeObjectEntry[]> {
    await this.updateClassMap();

    return this._classMap;
  }

  addClassMapFile(sourceUri: vscode.Uri): void {
    this._dirty = true;
    this.classMapFileURLs.add(sourceUri.toString());
    this._onChanged.fire(this);
  }

  removeClassMapFile(sourceUri: vscode.Uri): void {
    this._dirty = true;
    this.classMapFileURLs.delete(sourceUri.toString());
    this._onChanged.fire(this);
  }

  protected async updateClassMap(): Promise<void> {
    if (this._dirty) {
      const { codeObjectByFqid, classMap } = await backgroundJob('appmap.updateClassMap', () =>
        buildClassMap(this.classMapFileURLs, (url: vscode.Uri) =>
          vscode.workspace.getWorkspaceFolder(url)
        )
      );
      console.log(
        `[class-map] ClassMap updated with ${Object.keys(codeObjectByFqid).length} code objects`
      );
      this._dirty = false;
      this._codeObjectByFqid = codeObjectByFqid;
      this._classMap = classMap;
    }
  }
}
