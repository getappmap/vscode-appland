import '../mock/vscode';

import assert from 'assert';
import { SinonSandbox, createSandbox } from 'sinon';

import { AppmapignoreManager } from '../../../src/services/appmapConfigManager';

import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

describe('AppmapignoreManager', () => {
  let sinon: SinonSandbox;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWorkspaceFolder: any;
  let appmapignoreManager: AppmapignoreManager;
  let tmpDir: string;

  beforeEach(() => {
    sinon = createSandbox();
    tmpDir = path.join(tmpdir(), randomUUID());
    mkdirSync(tmpDir);

    mockWorkspaceFolder = {
      uri: {
        fsPath: tmpDir,
      },
    };

    appmapignoreManager = new AppmapignoreManager(mockWorkspaceFolder);
  });

  afterEach(() => {
    sinon.restore();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('does not add exclusions when no .appmapignore file is present', () => {
    assert.deepStrictEqual(appmapignoreManager.getExclusions(), []);
  });

  it('adds exclusions when a .appmapignore file is present', () => {
    const appmapignoreFileLines = ['test', 'test2/', '/test3', '/test4/'];
    writeFileSync(path.join(tmpDir, '.appmapignore'), appmapignoreFileLines.join('\n'));

    const expectedExclusions = ['**/test', '**/test2', 'test3', 'test4'];
    assert.deepStrictEqual(appmapignoreManager.getExclusions(), expectedExclusions);
  });

  it('ignores empty lines and comments in .appmapignore file', () => {
    const appmapignoreFileLines = ['test', '', '# test2', '/test3', '/test4/'];
    writeFileSync(path.join(tmpDir, '.appmapignore'), appmapignoreFileLines.join('\n'));

    const expectedExclusions = ['**/test', 'test3', 'test4'];
    assert.deepStrictEqual(appmapignoreManager.getExclusions(), expectedExclusions);
  });
});
