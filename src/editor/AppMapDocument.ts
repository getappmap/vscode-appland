import * as vscode from 'vscode';
import { FindingInfo, FunctionStats } from './appmapEditorProvider';

type MapStats = {
  functions?: FunctionStats[];
};

export default class AppMapDocument implements vscode.CustomDocument {
  public appMap: Record<string, unknown>;
  public sequenceDiagram?: Record<string, unknown>;
  public metadata: Record<string, unknown> = {};

  constructor(
    public uri: vscode.Uri,
    public appMapData: string,
    public stats: MapStats,
    public findings?: FindingInfo[],
    public sequenceDiagramData?: string
  ) {
    const appMap = JSON.parse(appMapData);
    if (findings && findings.length !== 0) appMap.findings = findings;
    appMap.stats = stats || {};
    this.appMap = appMap;
    if ('metadata' in this.appMap) this.metadata = this.appMap.metadata as Record<string, unknown>;
    if (sequenceDiagramData) this.sequenceDiagram = JSON.parse(sequenceDiagramData);
  }

  get workspaceFolder(): vscode.WorkspaceFolder | undefined {
    const { workspaceFolders } = vscode.workspace;

    let bestMatch: vscode.WorkspaceFolder | undefined;
    let bestMatchLength = 0;

    for (const workspaceFolder of workspaceFolders || []) {
      const { length } = workspaceFolder.name;
      if (bestMatchLength > length) {
        // The best match matches more characters than this directory has available.
        // This folder will never be a best match. Skip.
        return;
      }

      if (isUriParentOf(workspaceFolder.uri, this.uri)) {
        bestMatch = workspaceFolder;
        bestMatchLength = length;
      }
    }

    return bestMatch;
  }

  get fileName(): string {
    // note: this regexp matches any string
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.uri.path.match(/([^/]*)$/)![1];
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  dispose(): void {}
}

/**
 * Check if an uri is a parent of another.
 * A parent has the same scheme and authority, and its path is a prefix of the child path.
 * Note query and fragments are not checked in this naive implementation.
 */
function isUriParentOf(parent: vscode.Uri, child: vscode.Uri): boolean {
  if (parent.scheme !== child.scheme || parent.authority !== child.authority) return false;
  if (!child.path.startsWith(parent.path)) return false;

  const { length } = parent.path;

  // this relation isn't reflexive
  if (child.path.length === length) return false;

  // this still leaves the possibility of eg. /a/path and /a/path-that-is-unrelated/file
  return parent.path[length - 1] === '/' || child.path[length] === '/';
}
