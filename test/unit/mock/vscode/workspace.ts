/* eslint @typescript-eslint/naming-convention: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */

import type { workspace, WorkspaceFolder } from 'vscode';
import { URI } from 'vscode-uri';

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

export const TEST_WORKSPACE = {
  uri: URI.file('test'),
  index: 0,
  name: 'test',
};

export default {
  fs,
  getConfiguration: () => new Map<string, unknown>(),
  workspaceFolders: [],
  onDidChangeConfiguration: () => () => unimplemented,
  getWorkspaceFolder(uri: unknown): WorkspaceFolder | undefined {
    return uri ? TEST_WORKSPACE : undefined;
  },
};
