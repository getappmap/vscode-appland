import '../mock/vscode';

import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import os, { tmpdir } from 'os';

import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';

import Sinon from 'sinon';

import { JavaAgentDownloader } from '../../../src/assets';
import mockAssetApis from './mockAssetApis';

chai.use(chaiFs);

describe('JavaAgentDownloader', () => {
  it('downloads the Java agent to the expected location', async () => {
    await JavaAgentDownloader();

    const downloadDir = join(homeDir, '.appmap', 'lib', 'java');

    expect(join(downloadDir, 'appmap-0.0.0-TEST.jar'))
      .to.be.a.file()
      .with.content('<insert jar here>');
  });

  let homeDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-appmap-download-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    mockAssetApis();
  });
  afterEach(() => {
    Sinon.restore();
    mockAssetApis.restore();
  });
});
