import '../mock/vscode';
import mockAssetApis from './mockAssetApis';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, readdir, rm, writeFile, symlink } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import AssetService from '../../../src/assets/assetService';
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
        .with.files(['appmap-v0.0.0-TEST']);

      expect(join(appmapDir, 'lib', 'scanner'))
        .to.be.a.directory()
        .with.files(['scanner-v0.0.0-TEST']);

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
        .with.files([`appmap-v${ResourceVersions.appmap}`]);
      expect(join(appmapDir, 'lib', 'scanner'))
        .to.be.a.directory()
        .with.files([`scanner-v${ResourceVersions.scanner}`]);
    });

    it('cleans up old binaries', async () => {
      const appmapDir = join(homeDir, '.appmap');
      mockAssetApis({
        scanner: '1.88.0',
        javaAgent: '1.26.2',
      });
      async function createDummyFiles(
        directory: string,
        fileNameTemplate: string,
        versions: string[]
      ) {
        const parent = join(appmapDir, directory);
        await mkdir(parent, { recursive: true });
        await Promise.all(
          versions.map(async (version) => {
            const fileName = fileNameTemplate.replace('{VERSION}', version);
            const filePath = join(parent, fileName);
            await writeFile(filePath, '<dummy content>');
          })
        );
      }
      await createDummyFiles(join('lib', 'appmap'), 'appmap-v{VERSION}', [
        '0.0.0-ALPHA',
        '0.0.0-BETA',
        '0.0.0-SYMLINKED',
        // '0.0.0-TEST' will be downloaded and kept
      ]);
      const binDir = join(appmapDir, 'bin');
      await mkdir(binDir, { recursive: true });
      await symlink(
        join(appmapDir, 'lib', 'appmap', 'appmap-v0.0.0-SYMLINKED'),
        join(appmapDir, 'bin', 'appmap-SYMLINKED')
      );
      await createDummyFiles(join('lib', 'java'), 'appmap-{VERSION}.jar', [
        '1.25.9',
        '1.25.10',
        '1.26.2',
      ]);
      await createDummyFiles(join('lib', 'java'), 'appmap-agent-{VERSION}.jar', [
        '1.25.9',
        '1.25.10',
        '1.26.2',
      ]);
      await createDummyFiles(join('lib', 'java'), 'appmap.jar', ['unversioned']);
      await createDummyFiles(join('lib', 'scanner'), 'scanner-v{VERSION}', [
        '1.87.0',
        '1.87.1',
        '1.88.0',
      ]);
      await AssetService.updateAll(true);

      // Verify the results
      const verifyFiles = async (directory: string, expectedFiles: string[]) => {
        const files = await readdir(join(homeDir, '.appmap', directory));
        const expectedSet = new Set(expectedFiles);
        const remainingSet = new Set(files);

        expect(expectedSet).to.deep.equal(remainingSet);
      };

      // Verify each directory's expected files
      await verifyFiles(join('lib', 'appmap'), ['appmap-v0.0.0-SYMLINKED', 'appmap-v0.0.0-TEST']);
      await verifyFiles(join('lib', 'java'), [
        'appmap-1.26.2.jar',
        'appmap-agent-1.26.2.jar',
        'appmap.jar',
      ]);
      await verifyFiles(join('lib', 'scanner'), ['scanner-v1.88.0']);
    });
  });
});

describe('AssetService', () => {
  it('extracts semver from binaries correctly', () => {
    expect(AssetService.extractVersion('appmap-1.2.3.jar')).to.equal('1.2.3');
    expect(AssetService.extractVersion('appmap-v1.2.3')).to.equal('1.2.3');
    expect(AssetService.extractVersion('scanner-v1.2.3-ALPHA')).to.equal('1.2.3-ALPHA');
    expect(AssetService.extractVersion('scanner-v1.2.3-ALPHA.exe')).to.equal('1.2.3-ALPHA');
  });
});
