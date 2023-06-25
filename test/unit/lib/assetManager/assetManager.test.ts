import assert from 'assert';
import { existsSync, lstatSync, mkdirSync, writeFileSync } from 'fs';
import os, { tmpdir } from 'os';
import path, { basename, dirname, join } from 'path';
import { SinonSandbox, createSandbox } from 'sinon';

import { randomUUID } from 'crypto';
import { rm } from 'fs/promises';
import AssetManager from '../../../../src/lib/assetManager';
import TestProgressReporter from './TestProgressReporter';
import { debug } from 'console';

describe('asset manager', () => {
  let sinon: SinonSandbox;
  let tmpDir: string;
  let progressReporter: TestProgressReporter;
  let assetManager: AssetManager;
  let expectedJavaDir: string;

  beforeEach(async () => {
    tmpDir = path.join(tmpdir(), randomUUID());
    expectedJavaDir = path.join(tmpDir, '.appmap', 'lib', 'java');

    sinon = createSandbox();
    sinon.stub(os, 'homedir').returns(tmpDir);

    progressReporter = new TestProgressReporter();
    assetManager = new AssetManager(true, progressReporter);
  });

  afterEach(async () => sinon.restore());
  afterEach(async () => await rm(tmpDir, { recursive: true }));

  describe('acquires the lock', () => {
    it('downloads the latest jar', async () => {
      await assetManager.installLatestJavaJar();

      debug(progressReporter.messages);
      assert.deepStrictEqual(
        progressReporter.messages.map((message) => message.name),
        ['identifiedAsset', 'downloading', 'symlinked', 'downloaded']
      );

      const downloadedMessage = progressReporter.messages.find(
        (message) => message.name === 'downloaded'
      );
      assert(downloadedMessage);
      const assetPath = downloadedMessage.payload.assetPath as string;

      assert.equal(dirname(assetPath), expectedJavaDir);
      assert(existsSync(assetPath));
      const stats = lstatSync(assetPath);
      assert(stats.isFile());
    }).timeout(10000);

    it('creates a symlink to the latest jar', async () => {
      await assetManager.installLatestJavaJar();

      debug(progressReporter.messages);
      assert.deepStrictEqual(
        progressReporter.messages.map((message) => message.name),
        ['identifiedAsset', 'downloading', 'symlinked', 'downloaded']
      );

      const symlinkedMessage = progressReporter.messages.find(
        (message) => message.name === 'symlinked'
      );
      assert(symlinkedMessage);
      const assetName = symlinkedMessage.payload.assetName as string;
      const symlinkPath = symlinkedMessage.payload.symlinkPath as string;

      assert.match(assetName, /appmap-\d+\.\d+\.\d+.jar/);
      assert.equal(dirname(symlinkPath), expectedJavaDir);
      assert.equal(basename(symlinkPath), 'appmap.jar');
      assert(existsSync(join(expectedJavaDir, assetName)));
      const stats = lstatSync(join(expectedJavaDir, 'appmap.jar'));
      assert(stats.isSymbolicLink());
    });
  }).timeout(10000);

  describe('when the lock is already acquired', () => {
    beforeEach(() => {
      const identifiedAssetMethod = progressReporter.identifiedAsset;
      sinon.stub(progressReporter, 'identifiedAsset').callsFake((assetName: string) => {
        const assetPath = path.join(expectedJavaDir, assetName);
        const lockfile = assetPath + '.downloading';
        mkdirSync(path.join(expectedJavaDir), { recursive: true });
        writeFileSync(lockfile, 'lockfile');

        return identifiedAssetMethod.apply(progressReporter, [assetName]);
      });
    });

    it('does not download the latest jar', async () => {
      await assetManager.installLatestJavaJar();

      debug(progressReporter.messages);
      assert.deepStrictEqual(
        progressReporter.messages.map((message) => message.name),
        ['identifiedAsset', 'downloadLocked']
      );
    });
  });
});
