/* eslint @typescript-eslint/naming-convention: 0 */
/* eslint @typescript-eslint/no-unused-vars: 0 */

import Sinon from 'sinon';
import type { workspace, WorkspaceFolder } from 'vscode';
import { URI } from 'vscode-uri';
import { glob } from 'glob';

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
  // Defaults declared by a package.json `contributes.configuration` property. Values
  // written through update() are the equivalent of `globalValue`.
  private readonly defaults = new Map<string, unknown>();

  setDefault(key: string, value: unknown): void {
    if (value === undefined) this.defaults.delete(key);
    else this.defaults.set(key, value);
  }

  get(key: string, defaultValue?: unknown): unknown {
    let value = super.get(key);

    if (value === undefined && key.includes('.')) {
      const parts = key.split('.');
      let current: unknown = super.get(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        if (current && typeof current === 'object') {
          current = (current as Record<string, unknown>)[parts[i]];
        } else {
          current = undefined;
          break;
        }
      }
      value = current;
    }

    value = value ?? this.defaults.get(key) ?? defaultValue;
    // Simulate VS Code's proxy-backed configuration objects, which do not support
    // property deletion (attempting to do so throws a TypeError at runtime).
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.freeze({ ...value });
    }
    return value;
  }

  inspect(key: string): {
    key: string;
    defaultValue?: unknown;
    globalValue?: unknown;
    workspaceValue?: unknown;
  } {
    return { key, defaultValue: this.defaults.get(key), globalValue: super.get(key) };
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

export function resetConfigurations(): void {
  configs.clear();
}

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
  asRelativePath(pathOrUri: string | { fsPath?: string; path?: string }): string {
    const p = typeof pathOrUri === 'string' ? pathOrUri : pathOrUri.fsPath ?? pathOrUri.path ?? '';
    const folders = (this.workspaceFolders || []) as ReadonlyArray<WorkspaceFolder>;
    for (const folder of folders) {
      const base = folder.uri.fsPath;
      if (p === base) return '';
      if (p.startsWith(`${base}/`)) return p.slice(base.length + 1);
    }
    return p;
  },
  // Real filesystem glob, unlike VS Code's indexer-backed findFiles. Accepts either a
  // string glob (searched across workspaceFolders) or a RelativePattern ({ base, pattern }).
  findFiles(
    include: string | { base?: string; pattern?: string },
    exclude?: string | null | { pattern?: string },
    maxResults?: number,
    _token?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<URI[]> {
    const ignore =
      typeof exclude === 'string' ? [exclude] : exclude?.pattern ? [exclude.pattern] : undefined;
    const results: URI[] = [];
    const collect = (cwd: string, pattern: string) => {
      for (const p of glob.sync(pattern, { cwd, absolute: true, nodir: true, ignore })) {
        results.push(URI.file(p));
      }
    };
    if (include && typeof include === 'object') {
      if (include.base && include.pattern) collect(include.base, include.pattern);
    } else {
      const folders = (this.workspaceFolders || []) as ReadonlyArray<WorkspaceFolder>;
      for (const folder of folders) collect(folder.uri.fsPath, String(include));
    }
    return Promise.resolve(maxResults ? results.slice(0, maxResults) : results);
  },
};
