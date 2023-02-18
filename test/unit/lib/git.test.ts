import '../mock/vscode';

import vscode from 'vscode';
import { findRepository } from '../../../src/lib/git';
import { mockExtension, resetExtensionMocks } from '../mock/vscode/extensions';
import * as vscodeGit from '../../../types/vscode.git';
import { expect } from 'chai';
import { format } from 'node:util';

describe('findRepository()', () => {
  const examples = [
    [{ origin: 'https://repo.test/test/test.git' }, 'https://repo.test/test/test.git'],
    [{ other: 'https://repo.test/test/test.git' }, 'https://repo.test/test/test.git'],
    [
      { origin: undefined, other: 'https://repo.test/test/test.git' },
      'https://repo.test/test/test.git',
    ],
    [{ other: undefined }, undefined],
    [undefined, undefined],
    [null, undefined],
    [{ origin: 'https://user:pass@repo.test/test/test.git' }, 'https://repo.test/test/test.git'],
    [{ origin: 'https://token@repo.test/test/test.git' }, 'https://repo.test/test/test.git'],
    [
      { origin: 'git@github.com:getappmap/appmap-server.git' },
      'ssh://github.com/getappmap/appmap-server.git',
    ],
    [{ origin: '/some/local/path' }, 'file:///some/local/path'],
  ];

  for (const [repos, expected] of examples) {
    it(format('returns %s with %o', expected, repos), () => {
      if (repos === null) gitPresent = false;
      else if (repos)
        for (const [name, fetchUrl] of Object.entries(repos)) {
          if (fetchUrl) remotes.push({ name, fetchUrl });
          else remotes.push({ name });
        }
      expect(findRepository(vscode.Uri.parse('file:///test/project'))).to.equal(expected);
    });
  }
});

const remotes: Partial<vscodeGit.Remote>[] = [];
let gitPresent = true;

function getRepository(): vscodeGit.Repository | null {
  if (!gitPresent) return null;

  const state: Partial<vscodeGit.RepositoryState> = { remotes: remotes as vscodeGit.Remote[] };
  const result: Partial<vscodeGit.Repository> = {
    state: state as vscodeGit.RepositoryState,
  };
  return result as vscodeGit.Repository;
}

beforeEach(() => {
  mockExtension<vscodeGit.GitExtension>('vscode.git', {
    enabled: true,
    getAPI() {
      const api: Partial<vscodeGit.API> = {
        getRepository,
      };
      return api as vscodeGit.API;
    },
  });
});

afterEach(() => {
  gitPresent = true;
  resetExtensionMocks();
  remotes.splice(0, 42);
});
