import '../mock/vscode';
import mockAssetApis from './mockAssetApis';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import AssetService from '../../../src/assets/assetService';
import ResourceVersions from '../../../resources/versions.json';
import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';
import { BundledFileDownloadUrlResolver } from '../../../src/assets';

chai.use(chaiFs);

describe('AssetService', () => {
  let homeDir: string;
  const platform = 'linux';
  const arch = 'x64';

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-asset-service-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    Sinon.stub(process, 'platform').value(platform);
    Sinon.stub(process, 'arch').value(arch);
    downloadHttpRetry.maxTries = 1; // don't retry, we're testing fallbacks
  });

  afterEach(async () => {
    Sinon.restore();
    mockAssetApis.restore();
    await rm(homeDir, { recursive: true });
    downloadHttpRetry.maxTries = 3;
  });

  describe('updateAll', () => {
    it('should update all assets', async () => {
      mockAssetApis();
      await AssetService.updateAll(true);

      const appmapDir = join(homeDir, '.appmap');
      expect(appmapDir).to.be.a.directory().with.subDirs(['bin', 'lib']);
      expect(join(appmapDir, 'bin', 'scanner')).to.be.a.file();
      expect(join(appmapDir, 'bin', 'appmap')).to.be.a.file();

      expect(join(appmapDir, 'lib'))
        .to.be.a.directory()
        .with.subDirs(['appmap', 'java', 'scanner']);

      expect(join(appmapDir, 'lib', 'appmap'))
        .to.be.a.directory()
        .with.files(['appmap-v0.0.0-TEST']);

      expect(join(appmapDir, 'lib', 'scanner'))
        .to.be.a.directory()
        .with.files(['scanner-v0.0.0-TEST']);

      expect(join(appmapDir, 'lib', 'java'))
        .to.be.a.directory()
        .with.files(['appmap.jar', 'appmap-0.0.0-TEST.jar']);
    });

    it('falls back to a bundled jar if every strategy fails', async () => {
      const expectedVersion = ResourceVersions['appmap-java.jar'];
      mockAssetApis({
        javaAgent: expectedVersion,
        denylist: ['maven', 'github', 'npm'],
      });

      BundledFileDownloadUrlResolver.extensionDirectory = homeDir;

      await mkdir(join(homeDir, 'resources'), { recursive: true });
      await writeFile(join(homeDir, 'resources', 'appmap-java.jar'), '<insert bundled jar here>');
      await AssetService.updateAll(false);

      const appmapDir = join(homeDir, '.appmap');
      expect(appmapDir).to.be.a.directory().with.subDirs(['bin', 'lib']);
      expect(join(appmapDir, 'bin')).to.be.a.directory().and.empty;
      expect(join(appmapDir, 'lib', 'java'))
        .to.be.a.directory()
        .with.files([`appmap-${expectedVersion}.jar`, 'appmap.jar']);
      expect(join(appmapDir, 'lib', 'java', 'appmap.jar'))
        .to.be.a.file()
        .with.content('<insert bundled jar here>');
    });

    it('falls back to static version identifiers', async () => {
      mockAssetApis({
        appmap: ResourceVersions.appmap,
        scanner: ResourceVersions.scanner,
        denylist: ['npm'], // This is the only strategy for versioning the AppMap CLI and Scanner
      });

      await AssetService.updateAll(false);

      const appmapDir = join(homeDir, '.appmap');
      expect(appmapDir).to.be.a.directory().with.subDirs(['bin', 'lib']);
      expect(join(appmapDir, 'bin', 'scanner')).to.be.a.file();
      expect(join(appmapDir, 'bin', 'appmap')).to.be.a.file();
      expect(join(appmapDir, 'lib', 'appmap'))
        .to.be.a.directory()
        .with.files([`appmap-v${ResourceVersions.appmap}`]);
      expect(join(appmapDir, 'lib', 'scanner'))
        .to.be.a.directory()
        .with.files([`scanner-v${ResourceVersions.scanner}`]);
    });
  });
});
