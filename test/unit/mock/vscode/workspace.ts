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

export class Configuration extends Map<string, unknown> {
  get(key: string, defaultValue?: unknown): unknown {
    return super.get(key) ?? defaultValue;
  }

  inspect(key: string): { workspaceValue?: unknown } | undefined {
    return {};
  }

  update(key: string, value: unknown, target?: unknown): Promise<void> {
    if (value === undefined || value === null) {
      this.delete(key);
    } else {
      let filteredValue = value;
      if (typeof value === 'object') {
        // Undefined/null values are deleted
        filteredValue = Object.entries(value).reduce((acc, [k, v]) => {
          if (v !== undefined && v !== null) acc[k] = v;
          return acc;
        }, {});
      }
      this.set(key, filteredValue);
    }
    return Promise.resolve();
  }
}

const configs = new Map<string, Configuration>();

export default {
  fs,
  getConfiguration: (key: string) => {
    let config = configs.get(key);
    if (!config) configs.set(key, (config = new Configuration()));
    return config;
  },
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
    _token?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<URI[]> {
    const nonWildcardPath = include.replace(/(\*+\/?)/g, '');
    const absolutePath = join('/', 'example', nonWildcardPath);
    return Promise.resolve([URI.file(absolutePath)]);
  },
};
