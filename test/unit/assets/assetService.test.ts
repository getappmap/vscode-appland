import '../mock/vscode';
import mockAssetApis from './mockAssetApis';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import AssetService, { AssetIdentifier } from '../../../src/assets/assetService';
import ResourceVersions from '../../../resources/versions.json';
import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';
import { BundledFileDownloadUrlResolver, isInitialDownloadCompleted } from '../../../src/assets';

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
        .with.files(['appmap-linux-x64-0.0.0-TEST']);

      expect(join(appmapDir, 'lib', 'scanner'))
        .to.be.a.directory()
        .with.files(['scanner-linux-x64-0.0.0-TEST']);

      expect(join(appmapDir, 'lib', 'java'))
        .to.be.a.directory()
        .with.files(['appmap.jar', 'appmap-0.0.0-TEST.jar']);

      expect(await isInitialDownloadCompleted()).to.be.true;
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
        .with.files([`appmap-linux-x64-${ResourceVersions.appmap}`]);
      expect(join(appmapDir, 'lib', 'scanner'))
        .to.be.a.directory()
        .with.files([`scanner-linux-x64-${ResourceVersions.scanner}`]);
    });
  });

  describe('getMostRecentVersion', () => {
    it('returns undefined if the asset directory does not exist', async () => {
      const version = await AssetService.getMostRecentVersion(AssetIdentifier.AppMapCli);
      expect(version).to.be.undefined;
    });

    it('returns the most recent version', async () => {
      const appmapDir = join(homeDir, '.appmap', 'lib', 'appmap');
      await mkdir(appmapDir, { recursive: true });
      await writeFile(join(appmapDir, 'appmap-linux-x64-0.1.0'), '');
      await writeFile(join(appmapDir, 'appmap-linux-x64-0.2.0'), '');
      await writeFile(join(appmapDir, 'appmap-linux-x64-0.10.0'), '');
      await writeFile(join(appmapDir, 'appmap-linux-x64-0.2.1'), '');

      const version = await AssetService.getMostRecentVersion(AssetIdentifier.AppMapCli);
      expect(version).to.equal('0.10.0');
    });

    it('returns undefined if the asset ID is invalid', async () => {
      let caught = false;
      try {
        // @ts-expect-error testing invalid input
        await AssetService.getMostRecentVersion('invalid');
      } catch {
        caught = true;
      }
      expect(caught).to.be.true;
    });
  });
});
