import { isAbsolute } from 'path';
import * as vscode from 'vscode';
import ClassMapIndex from './classMapIndex';
import { CodeObjectEntry } from '../lib/CodeObjectEntry';

class LineInfo {
  public codeObjects?: CodeObjectEntry[];

  constructor(public line: number) {}

  addCodeObject(codeObject: CodeObjectEntry) {
    if (!this.codeObjects) this.codeObjects = [];
    this.codeObjects.push(codeObject);
  }
}

export default class LineInfoIndex {
  // TODO: Dispose of this event emitter.
  private _onChanged = new vscode.EventEmitter<LineInfoIndex>();
  public readonly onChanged = this._onChanged.event;

  constructor(public classMapIndex: ClassMapIndex) {
    classMapIndex.onChanged(() => this._onChanged.fire(this));
  }

  async lineInfo(uri: vscode.Uri): Promise<LineInfo[]> {
    const result: Record<number, LineInfo> = {};

    const lineInfo = (line: number): LineInfo => {
      if (!result[line]) result[line] = new LineInfo(line);
      return result[line];
    };

    const classMap = await this.classMapIndex.classMap();
    const collectCodeObject = (codeObject: CodeObjectEntry) => {
      if (codeObject.path && codeObject.lineNo) {
        const codeObjectUri = isAbsolute(codeObject.path)
          ? vscode.Uri.file(codeObject.path)
          : vscode.Uri.joinPath(codeObject.folder.uri, codeObject.path);
        if (codeObjectUri.fsPath === uri.fsPath) {
          lineInfo(codeObject.lineNo - 1).addCodeObject(codeObject);
        }
      }
      codeObject.children.forEach(collectCodeObject);
    };
    classMap.forEach(collectCodeObject);

    return Object.values(result);
  }
}
