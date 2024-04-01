import '../mock/vscode';
import Sinon from 'sinon';
import os, { tmpdir } from 'os';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'path';
import nock from 'nock';
import AssetService from '../../../src/assets/assetService';
import ResourceVersions from '../../../resources/versions.json';

chai.use(chaiFs);

type AssetVersionMocks = {
  appmap?: string;
  scanner?: string;
  javaAgent?: string;
  denylist?: string[];
};

function mockApi(
  url: URL | string,
  response: () => string | Record<string, unknown>,
  denylist: string[]
) {
  const { origin, pathname } = typeof url === 'string' ? new URL(url) : url;
  const isDenylisted = denylist.some((deny) => origin.includes(deny));
  const scope = nock(origin).get(pathname);
  return isDenylisted ? scope.reply(403) : scope.reply(200, response());
}

const defaultVersion = '0.0.0-TEST';
function mockAssetApis(opts: AssetVersionMocks = {}) {
  const options = {
    appmap: defaultVersion,
    scanner: defaultVersion,
    javaAgent: defaultVersion,
    denylist: [],
    ...opts,
  };

  mockApi(
    'https://repo1.maven.org/maven2/com/appland/appmap-agent/maven-metadata.xml',
    () => `<release>${options.javaAgent}</release>`,
    options.denylist
  );
  mockApi(
    'https://registry.npmjs.org/@appland/appmap/latest',
    () => ({ version: options.appmap }),
    options.denylist
  );
  mockApi(
    'https://registry.npmjs.org/@appland/scanner/latest',
    () => ({ version: options.scanner }),
    options.denylist
  );
  mockApi(
    'https://api.github.com/repos/getappmap/appmap-java/releases/latest',
    () => ({
      tag_name: `v${options.javaAgent}`,
    }),
    options.denylist
  );
  mockApi(
    `https://repo1.maven.org//maven2/com/appland/appmap-agent/${options.javaAgent}/appmap-agent-${options.javaAgent}.jar`,
    () => '<insert jar here>',
    options.denylist
  );
  mockApi(
    `https://github.com/getappmap/appmap-java/releases/download/v${options.javaAgent}/appmap-${options.javaAgent}.jar`,
    () => '<insert jar here>',
    options.denylist
  );
  mockApi(
    `https://github.com/getappmap/appmap-js/releases/download/%40appland%2Fscanner-v${options.scanner}%2Fscanner-linux-x64`,
    () => '<insert scanner here>',
    options.denylist
  );
  mockApi(
    `https://github.com/getappmap/appmap-js/releases/download/%40appland%2Fappmap-v${options.appmap}%2Fappmap-linux-x64`,
    () => '<insert appmap cli here>',
    options.denylist
  );

  return options;
}

describe('AssetService', () => {
  let homeDir: string;
  const platform = 'linux';
  const arch = 'x64';

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-asset-service-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    Sinon.stub(process, 'platform').value(platform);
    Sinon.stub(process, 'arch').value(arch);
  });

  afterEach(async () => {
    Sinon.restore();
    nock.cleanAll();
    await rm(homeDir, { recursive: true });
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

      // Private variable access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (AssetService as any)._extensionDirectory = homeDir;

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
