import '../mock/vscode';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import { AppMapCliDownloader } from '../../../src/assets';
import { DownloadHooks } from '../../../src/assets/assetDownloader';

chai.use(chaiFs);

describe('AppMapCliDownloader', () => {
  let homeDir: string;
  const platform = 'win32';
  const arch = 'x64';

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-appmap-download-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    Sinon.stub(process, 'platform').value(platform);
    Sinon.stub(process, 'arch').value(arch);
  });

  afterEach(async () => {
    Sinon.restore();
    await rm(homeDir, { recursive: true });
  });

  it('fixes missing symlinks', async () => {
    // Private variable access
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { skippedDownload } = (AppMapCliDownloader as any).downloadHooks as DownloadHooks;

    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(join(homeDir, '.appmap', 'lib', 'appmap'), { recursive: true });
    await writeFile(join(homeDir, '.appmap', 'lib', 'appmap', 'appmap-v0.0.0-TEST'), 'test');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await skippedDownload!('0.0.0-TEST');

    // Upon skipping the download, the missing symlink should be restored
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe')).to.be.a.file();
  });
});
