import * as vscode from 'vscode';

export default class AppMapDocument implements vscode.CustomDocument {
  public data: Record<string, unknown>;
  public metadata: Record<string, unknown> = {};

  constructor(public uri: vscode.Uri, public raw: Uint8Array) {
    this.data = JSON.parse(raw.toString());
    if ('metadata' in this.data) this.metadata = this.data.metadata as Record<string, unknown>;
  }

  get workspaceFolder(): vscode.WorkspaceFolder | undefined {
    const { workspaceFolders } = vscode.workspace;
    if (!workspaceFolders) {
      return undefined;
    }

    let bestMatch: vscode.WorkspaceFolder | undefined;
    let bestMatchLength = 0;
    workspaceFolders.forEach((workspaceFolder) => {
      const { length } = workspaceFolder.name;
      if (bestMatchLength > length) {
        // The best match matches more characters than this directory has available.
        // This folder will never be a best match. Skip.
        return;
      }

      if (this.uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
        bestMatch = workspaceFolder;
        bestMatchLength = length;
      }
    });

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
