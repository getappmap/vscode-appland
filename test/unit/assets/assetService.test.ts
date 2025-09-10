import '../mock/vscode';
import mockAssetApis from './mockAssetApis';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import AssetService from '../../../src/assets/assetService';
import { AssetIdentifier, listAssets } from '../../../src/assets';
import ResourceVersions from '../../../resources/versions.json';
import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';
import {
  BundledFileDownloadUrlResolver,
  cacheDir,
  isInitialDownloadCompleted,
} from '../../../src/assets';

chai.use(chaiFs);

describe('AssetService', () => {
  let homeDir: string;
  let cache: string;
  const platform = 'linux';
  const arch = 'x64';

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-asset-service-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    Sinon.stub(process, 'platform').value(platform);
    Sinon.stub(process, 'arch').value(arch);
    cache = cacheDir();
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

      expect(cache)
        .to.be.a.directory()
        .with.files([
          'appmap-linux-x64-0.0.0-TEST',
          'scanner-linux-x64-0.0.0-TEST',
          'appmap-0.0.0-TEST.jar',
        ]);

      expect(join(appmapDir, 'lib', 'java')).to.be.a.directory().with.files(['appmap.jar']);

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
      expect(join(appmapDir, 'lib', 'java')).to.be.a.directory().with.files(['appmap.jar']);
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
      expect(cache)
        .to.be.a.directory()
        .with.files([
          `appmap-linux-x64-${ResourceVersions.appmap}`,
          `scanner-linux-x64-${ResourceVersions.scanner}`,
          'appmap-0.0.0-TEST.jar',
        ]);
    });
  });

  describe('getMostRecentVersion', () => {
    it('returns undefined if the asset directory does not exist', async () => {
      const version = await AssetService.getMostRecentVersion(AssetIdentifier.AppMapCli);
      expect(version).to.be.undefined;
    });

    it('returns the most recent version', async () => {
      await mkdir(cache, { recursive: true });

      const SCANNER_VS = ['0.1.0', '0.2.0', '0.10.0', '0.2.1', '0.11.0-beta1', '0.11.0+22'];
      const APPMAP_VS = ['0.1.1', '0.2.1', '0.10.1', '0.2.2', '0.10.1-beta2'];
      const JAVA_VS = ['0.1.2', '0.2.2', '0.10.2', '0.2.3'];

      for (const v of JAVA_VS) {
        await writeFile(join(cache, `appmap-${v}.jar`), '');
      }
      for (const v of SCANNER_VS) {
        await writeFile(join(cache, `scanner-linux-x64-${v}`), '');
      }
      for (const v of APPMAP_VS) {
        await writeFile(join(cache, `appmap-linux-x64-${v}`), '');
      }

      // write ostensibly newer versions for other platforms
      await writeFile(join(cache, `appmap-windows-x64-99.99.99.exe`), '');
      await writeFile(join(cache, `scanner-windows-x64-99.99.99.exe`), '');

      const expected = {
        AppMapCli: '0.10.1',
        ScannerCli: '0.11.0+22',
        JavaAgent: '0.10.2',
      };

      for (const [id, ver] of Object.entries(expected)) {
        const v = await AssetService.getMostRecentVersion(AssetIdentifier[id]);
        expect(v).to.equal(ver);
        expect(AssetService.getAssetPath(AssetIdentifier[id])).to.equal(
          join(
            homeDir,
            '.appmap',
            id === 'JavaAgent' ? 'lib' : 'bin',
            id === 'JavaAgent' ? 'java/appmap.jar' : id === 'AppMapCli' ? 'appmap' : 'scanner'
          )
        );
      }
    });
  });

  describe('listAssets', () => {
    it('returns an empty list if the asset directory does not exist', async () => {
      const assets = await listAssets(AssetIdentifier.AppMapCli);
      expect(assets).to.be.an('array').that.is.empty;
    });

    it('includes bundled assets', async () => {
      const bundledDir = join(homeDir, 'resources');
      await mkdir(bundledDir, { recursive: true });
      await writeFile(join(bundledDir, 'appmap-linux-x64-0.9.0'), '');
      await writeFile(join(bundledDir, 'scanner-linux-x64-0.9.0'), '');
      BundledFileDownloadUrlResolver.extensionDirectory = homeDir;

      const assets = await listAssets(AssetIdentifier.AppMapCli);
      expect(assets).to.be.an('array').that.has.lengthOf(1);
      expect(assets[0]).to.match(/appmap-linux-x64-0.9.0$/);

      const scannerAssets = await listAssets(AssetIdentifier.ScannerCli);
      expect(scannerAssets).to.be.an('array').that.has.lengthOf(1);
      expect(scannerAssets[0]).to.match(/scanner-linux-x64-0.9.0$/);
    });

    it('includes appmap-java.jar from resources', async () => {
      const bundledDir = join(homeDir, 'resources');
      await mkdir(bundledDir, { recursive: true });
      await writeFile(join(bundledDir, 'appmap-java.jar'), '');
      BundledFileDownloadUrlResolver.extensionDirectory = homeDir;

      const assets = await listAssets(AssetIdentifier.JavaAgent);
      expect(assets).to.be.an('array').that.has.lengthOf(1);
      expect(assets[0]).to.match(/appmap-java.jar$/);
    });

    it('handles invalid version strings', async () => {
      await mkdir(cache, { recursive: true });
      const VERSIONS = ['0.1.0', '0.2.0', 'not-a-version', '0.10.0', 'also-not-a-version'];
      for (const v of VERSIONS) {
        await writeFile(join(cache, `appmap-linux-x64-${v}`), '');
      }

      const assets = await listAssets(AssetIdentifier.AppMapCli);
      expect(assets.slice(0, 3))
        .to.be.an('array')
        .with.members([
          join(cache, 'appmap-linux-x64-0.10.0'),
          join(cache, 'appmap-linux-x64-0.2.0'),
          join(cache, 'appmap-linux-x64-0.1.0'),
        ]);
    });

    it("ignores files that don't match the expected pattern", async () => {
      await mkdir(cache, { recursive: true });
      const FILES = [
        'appmap-linux-x64-0.1.0',
        'appmap-linux-x64-0.1.0.part',
        'appmap-linux-x64-0.2.0',
        'not-an-appmap-asset',
        'appmap-windows-x64-0.10.0.exe',
        'also-not-an-appmap-asset',
      ];
      for (const f of FILES) {
        await writeFile(join(cache, f), '');
      }

      const assets = await listAssets(AssetIdentifier.AppMapCli);
      expect(assets)
        .to.be.an('array')
        .with.members([
          join(cache, 'appmap-linux-x64-0.2.0'),
          join(cache, 'appmap-linux-x64-0.1.0'),
        ]);
    });
  });

  describe('ensureLinks', () => {
    it('returns true if all links are present', async () => {
      mockAssetApis();
      await AssetService.updateAll(true);
      const allPresent = await AssetService.ensureLinks();
      expect(allPresent).to.be.true;
    });

    it('restores missing links and returns false', async () => {
      mockAssetApis();

      const appmapDir = join(homeDir, '.appmap');

      let allPresent = await AssetService.ensureLinks();
      expect(allPresent).to.be.false;

      await AssetService.updateAll(true);
      allPresent = await AssetService.ensureLinks();
      expect(allPresent).to.be.true;
      expect(appmapDir).to.be.a.directory().with.subDirs(['bin', 'lib']);
      expect(join(appmapDir, 'bin', 'scanner')).to.be.a.file();
      expect(join(appmapDir, 'bin', 'appmap')).to.be.a.file();
      expect(join(appmapDir, 'lib', 'java')).to.be.a.directory().with.files(['appmap.jar']);
    });

    it('can link up bundled assets if no cached version exists', async () => {
      const bundledDir = join(homeDir, 'resources');
      await mkdir(bundledDir, { recursive: true });
      await writeFile(join(bundledDir, 'appmap-linux-x64-0.9.0'), '');
      await writeFile(join(bundledDir, 'scanner-linux-x64-0.9.0'), '');
      await writeFile(join(bundledDir, 'appmap-java.jar'), '');
      BundledFileDownloadUrlResolver.extensionDirectory = homeDir;

      const allPresent = await AssetService.ensureLinks();
      expect(allPresent).to.be.true;

      const appmapDir = join(homeDir, '.appmap');
      expect(appmapDir).to.be.a.directory().with.subDirs(['bin', 'lib']);
      expect(join(appmapDir, 'bin', 'scanner')).to.be.a.file();
      expect(join(appmapDir, 'bin', 'appmap')).to.be.a.file();
      expect(join(appmapDir, 'lib')).to.be.a.directory().with.subDirs(['java']);
      expect(join(appmapDir, 'lib', 'java')).to.be.a.directory().with.files(['appmap.jar']);
    });
  });
});
