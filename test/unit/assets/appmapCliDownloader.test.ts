import '../mock/vscode';
import mockAssetApis from './mockAssetApis';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import {
  AppMapCliDownloader,
  BundledFileDownloadUrlResolver,
  cacheDir,
  initialDownloadCompleted,
} from '../../../src/assets';

chai.use(chaiFs);

describe('AppMapCliDownloader', () => {
  let homeDir: string;
  let cache: string;
  const platform = 'win32';
  const arch = 'x64';

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-appmap-download-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    BundledFileDownloadUrlResolver.extensionDirectory = homeDir;
    Sinon.stub(process, 'platform').value(platform);
    Sinon.stub(process, 'arch').value(arch);
    cache = cacheDir();
    mockAssetApis();
  });

  afterEach(async () => {
    Sinon.restore();
    await rm(homeDir, { recursive: true });
    mockAssetApis.restore();
  });

  it('fixes missing symlinks', async () => {
    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, 'appmap-win-x64-0.0.0-TEST.exe'), 'test');
    await initialDownloadCompleted();

    await AppMapCliDownloader();

    // Upon skipping the download, the missing symlink should be restored
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe')).to.be.a.file().with.content('test');
  });

  it('redownloads the asset if initial download is not completed', async () => {
    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, 'appmap-win-x64-0.0.0-TEST.exe'), 'test');

    await AppMapCliDownloader();

    // The target should be replaced
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe'))
      .to.be.a.file()
      .with.content('<insert appmap cli here>');
  });

  it("does not replace the target if no download happens and it's valid", async () => {
    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await mkdir(cache, { recursive: true });
    await writeFile(join(cache, 'appmap-win-x64-0.0.0-TEST.exe'), 'test');
    await writeFile(join(homeDir, '.appmap', 'bin', 'appmap.exe'), 'overriden test');
    await initialDownloadCompleted();

    await AppMapCliDownloader();

    // The target should not be replaced
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe'))
      .to.be.a.file()
      .with.content('overriden test');
  });

  it('does not download if the same version is bundled', async () => {
    const bundledDir = join(homeDir, 'resources');
    await mkdir(bundledDir, { recursive: true });
    await writeFile(join(bundledDir, 'appmap-win-x64-0.0.0-TEST.exe'), 'BUNDLED');

    await mkdir(join(homeDir, '.appmap', 'bin'), { recursive: true });
    await symlink(
      join(bundledDir, 'appmap-win-x64-0.0.0-TEST.exe'),
      join(homeDir, '.appmap', 'bin', 'appmap.exe')
    );
    await initialDownloadCompleted();

    await AppMapCliDownloader();

    // The target should not be replaced
    expect(join(homeDir, '.appmap', 'bin', 'appmap.exe')).to.be.a.file().with.content('BUNDLED');
  });

  describe('file naming and permissions', () => {
    const cases = [
      { platform: 'linux', arch: 'x64', expectedName: 'appmap-linux-x64-0.0.0-TEST' },
      { platform: 'linux', arch: 'arm64', expectedName: 'appmap-linux-arm64-0.0.0-TEST' },
      { platform: 'darwin', arch: 'x64', expectedName: 'appmap-macos-x64-0.0.0-TEST' },
      { platform: 'darwin', arch: 'arm64', expectedName: 'appmap-macos-arm64-0.0.0-TEST' },
      { platform: 'win32', arch: 'x64', expectedName: 'appmap-win-x64-0.0.0-TEST.exe' },
      { platform: 'win32', arch: 'arm64', expectedName: 'appmap-win-arm64-0.0.0-TEST.exe' },
    ];

    for (const c of cases) {
      it(`correctly names the file for ${c.platform}-${c.arch}`, async () => {
        Sinon.stub(process, 'platform').value(c.platform);
        Sinon.stub(process, 'arch').value(c.arch);
        cache = cacheDir();

        await AppMapCliDownloader();

        expect(cache).to.be.a.directory().with.files([c.expectedName]);
        const expectedPath = join(cache, c.expectedName);

        expect(expectedPath).to.be.a.file().with.content('<insert appmap cli here>');

        // check if it's executable on non-windows
        if (c.platform !== 'win32') {
          const stats = await stat(expectedPath);
          expect(stats.mode & 0o111).to.not.equal(0);
        }
      });
    }
  });
});
