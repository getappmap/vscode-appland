import '../mock/vscode';

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os, { tmpdir } from 'os';

import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';

import Sinon from 'sinon';

import { BundledFileDownloadUrlResolver, cacheDir, JavaAgentDownloader } from '../../../src/assets';
import mockAssetApis from './mockAssetApis';

chai.use(chaiFs);

describe('JavaAgentDownloader', () => {
  it('downloads the Java agent to the expected location', async () => {
    await JavaAgentDownloader();

    expect(cache).to.be.a.directory().with.files(['appmap-0.0.0-TEST.jar']);

    expect(join(cache, 'appmap-0.0.0-TEST.jar')).to.be.a.file().with.content('<insert jar here>');
  });

  it('does not download if the same version is bundled', async () => {
    const bundledDir = join(homeDir, 'resources');
    await mkdir(bundledDir, { recursive: true });
    await writeFile(join(bundledDir, 'appmap-0.0.1-TEST.jar'), 'BUNDLED');

    await JavaAgentDownloader();

    // The target should not be replaced
    expect(join(homeDir, '.appmap', 'lib', 'java', 'appmap.jar'))
      .to.be.a.file()
      .with.content('BUNDLED');

    // the cache should remain empty
    expect(cache).not.to.be.a.path();
  });

  let homeDir: string;
  let cache: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-appmap-download-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    BundledFileDownloadUrlResolver.extensionDirectory = homeDir;
    cache = cacheDir();
    mockAssetApis();
  });
  afterEach(() => {
    Sinon.restore();
    mockAssetApis.restore();
  });
});
