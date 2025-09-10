import '../mock/vscode';

import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import os, { tmpdir } from 'os';

import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';

import Sinon from 'sinon';

import { cacheDir, JavaAgentDownloader } from '../../../src/assets';
import mockAssetApis from './mockAssetApis';

chai.use(chaiFs);

describe('JavaAgentDownloader', () => {
  it('downloads the Java agent to the expected location', async () => {
    await JavaAgentDownloader();

    expect(cache).to.be.a.directory().with.files(['appmap-0.0.0-TEST.jar']);

    expect(join(cache, 'appmap-0.0.0-TEST.jar')).to.be.a.file().with.content('<insert jar here>');
  });

  let homeDir: string;
  let cache: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-appmap-download-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    cache = cacheDir();
    mockAssetApis();
  });
  afterEach(() => {
    Sinon.restore();
    mockAssetApis.restore();
  });
});
