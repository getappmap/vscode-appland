import assert from 'assert';
import { lstatSync } from 'fs';
import os, { tmpdir } from 'os';
import path, { join } from 'path';
import { SinonSandbox, createSandbox } from 'sinon';

import { initializeWorkspace, waitFor, waitForExtension } from '../util';
import { randomUUID } from 'crypto';
import { readdir } from 'fs/promises';

describe('asset manager', () => {
  let tmpDir: string;
  let sinon: SinonSandbox;

  before(async () => {
    tmpDir = path.join(tmpdir(), randomUUID());

    sinon = createSandbox();
    sinon.stub(os, 'homedir').returns(tmpDir);

    await initializeWorkspace();
    await waitForExtension();
  });

  after(async () => {
    sinon.restore();
    await initializeWorkspace();
  });

  // More complex behavior, such as the lock file, is tested in test/unit/lib/assetManager/assetManager.test.ts
  it('downloads the latest jar', async () => {
    const javaDir = join(tmpDir, '.appmap', 'lib', 'java');

    let jarFile: string | undefined;
    let symlinkFile: string | undefined;
    await waitFor('Waiting for jar to be downloaded', async () => {
      const assetFiles = await readdir(javaDir);

      if (!jarFile) jarFile = assetFiles.find((f) => /^appmap-\d+\.\d+\.\d+\.jar$/.test(f));
      if (!symlinkFile) symlinkFile = assetFiles.find((f) => f == 'appmap.jar');

      return !!jarFile && !!symlinkFile;
    });

    assert(jarFile);
    assert(symlinkFile);

    assert(lstatSync(join(javaDir, jarFile)).isFile());
    assert(lstatSync(join(javaDir, symlinkFile)).isSymbolicLink());
  });
});
