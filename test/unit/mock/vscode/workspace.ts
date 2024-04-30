/* eslint @typescript-eslint/naming-convention: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */

import Sinon from 'sinon';
import type { workspace, WorkspaceFolder } from 'vscode';
import { URI } from 'vscode-uri';
import { join } from 'path';

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

const listener = () => () => ({ dispose: Sinon.stub() });

export const EVENTS = {
  onDidChangeWorkspaceFolders: listener(),
  onDidChangeConfiguration: listener(),
};

export default {
  fs,
  getConfiguration: () => new Map<string, unknown>(),
  workspaceFolders: [],
  onDidChangeConfiguration: EVENTS.onDidChangeConfiguration,
  onDidChangeWorkspaceFolders: EVENTS.onDidChangeWorkspaceFolders,
  getWorkspaceFolder(uri: unknown): WorkspaceFolder | undefined {
    return uri ? TEST_WORKSPACE : undefined;
  },
  findFiles(
    include: string,
    _exclude?: string | null,
    _maxResults?: number,
    _token?: any
  ): Promise<URI[]> {
    const nonWildcardPath = include.replace(/(\*+\/?)/g, '');
    const absolutePath = join('/', 'example', nonWildcardPath);
    return Promise.resolve([URI.file(absolutePath)]);
  },
};
