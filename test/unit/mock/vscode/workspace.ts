/* eslint @typescript-eslint/naming-convention: 0 */
import type { workspace } from 'vscode';

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
};
