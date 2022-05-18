import * as vscode from 'vscode';
import ClassMapIndex, { CodeObjectEntry } from './classMapIndex';
import FindingsIndex from './findingsIndex';
import { ResolvedFinding } from './resolvedFinding';

class LineInfo {
  public findings?: ResolvedFinding[];
  public codeObjects?: CodeObjectEntry[];

  constructor(public line: number) {}

  addFinding(finding: ResolvedFinding) {
    if (!this.findings) this.findings = [];
    this.findings.push(finding);
  }

  addCodeObject(codeObject: CodeObjectEntry) {
    if (!this.codeObjects) this.codeObjects = [];
    this.codeObjects.push(codeObject);
  }
}

export default class LineInfoIndex {
  private _onChanged = new vscode.EventEmitter<LineInfoIndex>();
  public readonly onChanged = this._onChanged.event;

  constructor(public findingsIndex: FindingsIndex, public classMapIndex: ClassMapIndex) {
    findingsIndex.onChanged(this._onChanged.fire.bind(this, this));
    classMapIndex.onChanged(this._onChanged.fire.bind(this, this));
  }

  async lineInfo(uri: vscode.Uri): Promise<LineInfo[]> {
    const result: Record<number, LineInfo> = {};

    const lineInfo = (line: number): LineInfo => {
      if (!result[line]) result[line] = new LineInfo(line);
      return result[line];
    };

    this.findingsIndex
      .findings()
      .filter((finding) => finding.problemLocation)
      .filter((finding) => finding.problemLocation?.uri.toString() === uri.toString())
      .forEach((finding) =>
        finding.problemLocation
          ? lineInfo(finding.problemLocation?.range.start.line).addFinding(finding)
          : undefined
      );

    const classMap = await this.classMapIndex.classMap();
    const collectCodeObject = (codeObject: CodeObjectEntry) => {
      if (codeObject.path && codeObject.lineNo) {
        const codeObjectUri = vscode.Uri.joinPath(codeObject.folder.uri, codeObject.path);
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
