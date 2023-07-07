/* eslint @typescript-eslint/naming-convention: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */

import type { workspace, WorkspaceFolder } from 'vscode';
import type { URI } from 'vscode-uri';

const unimplemented = () => {
  throw new Error('unimplemented');
};

const fs: typeof workspace.fs = {
  copy: unimplemented,
  createDirectory: unimplemented,
  delete: unimplemented,
  isWritableFileSystem: unimplemented,
  readDirectory: unimplemented,
  readFile: unimplemented,
  rename: unimplemented,
  stat: unimplemented,
  writeFile: unimplemented,
};

export default {
  fs,
  getConfiguration: () => new Map<string, unknown>(),
  workspaceFolders: [],
  onDidChangeConfiguration: () => () => unimplemented,
  getWorkspaceFolder: (_uri: URI): WorkspaceFolder | undefined => undefined,
};
