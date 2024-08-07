import '../mock/vscode';
import mockAssetApis from './mockAssetApis';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import { AppMapCliDownloader, initialDownloadCompleted } from '../../../src/assets';

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
    mockAssetApis();
  });

  afterEach(async () => {
    Sinon.restore();
    await rm(homeDir, { recursive: true });
    mockAssetApis.restore();
  });

  it('fixes missing symlinks', async () => {
    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(join(homeDir, '.appmap', 'lib', 'appmap'), { recursive: true });
    await writeFile(join(homeDir, '.appmap', 'lib', 'appmap', 'appmap-v0.0.0-TEST'), 'test');
    await initialDownloadCompleted();

    await AppMapCliDownloader();

    // Upon skipping the download, the missing symlink should be restored
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe')).to.be.a.file().with.content('test');
  });

  it('redownloads the asset if initial download is not completed', async () => {
    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(join(homeDir, '.appmap', 'lib', 'appmap'), { recursive: true });
    await writeFile(join(homeDir, '.appmap', 'lib', 'appmap', 'appmap-v0.0.0-TEST'), 'test');

    await AppMapCliDownloader();

    // The target should be replaced
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe'))
      .to.be.a.file()
      .with.content('<insert appmap cli here>');
  });

  it("does not replace the target if no download happens and it's valid", async () => {
    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(join(homeDir, '.appmap', 'lib', 'appmap'), { recursive: true });
    await writeFile(join(homeDir, '.appmap', 'lib', 'appmap', 'appmap-v0.0.0-TEST'), 'test');
    await writeFile(join(homeDir, '.appmap', 'bin', 'appmap.exe'), 'overriden test');
    await initialDownloadCompleted();

    await AppMapCliDownloader();

    // The target should not be replaced
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe'))
      .to.be.a.file()
      .with.content('overriden test');
  });
});
