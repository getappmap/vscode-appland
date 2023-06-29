import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { tmpdir } from 'os';
import path from 'path';
import { SinonSandbox, createSandbox } from 'sinon';
import { randomUUID } from 'crypto';
import '../mock/vscode';
import { rm, realpath } from 'fs/promises';
import JavaAssetDownloader from '../../../src/lib/javaAssetDownloader';
import TestProgressReporter from './TestProgressReporter';
import * as fetch from 'node-fetch';
import { Readable } from 'stream';

chai.use(chaiFs);

describe('JavaAssetDownloader', () => {
  let sinon: SinonSandbox;
  let tmpDir: string;
  let progressReporter: TestProgressReporter;
  let javaAssetDownloader: JavaAssetDownloader;
  let archiveName: string;
  let agentDir: string;
  let agentSymlinkPath: string;
  const agentJarContents = 'insert bytes here';

  beforeEach(async () => {
    tmpDir = path.join(tmpdir(), randomUUID());
    agentDir = path.join(tmpDir, '.appmap', 'lib', 'java');
    agentSymlinkPath = path.join(agentDir, 'appmap.jar');
    archiveName = 'appmap-0.0.0.jar';

    (JavaAssetDownloader as any).JavaAgentDir = agentDir; // eslint-disable-line @typescript-eslint/no-explicit-any
    (JavaAssetDownloader as any).JavaAgentPath = agentSymlinkPath; // eslint-disable-line @typescript-eslint/no-explicit-any

    sinon = createSandbox();
    sinon.stub(fetch, 'default').callsFake(
      () =>
        Promise.resolve({
          ok: true,
          body: Readable.from(agentJarContents),
          json: sinon.stub().resolves({
            assets: [
              {
                content_type: 'application/java-archive',
                name: archiveName,
                browser_download_url: `http://127.0.0.1/${archiveName}`,
              },
            ],
          }),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    );

    progressReporter = new TestProgressReporter();
    javaAssetDownloader = new JavaAssetDownloader(progressReporter);
  });

  afterEach(() => sinon.restore());
  afterEach(() => rm(tmpDir, { recursive: true }));

  it('emits the expected progress events when a new version is downloaded', async () => {
    await javaAssetDownloader.installLatestJavaJar();
    expect(progressReporter.messages.map(({ name }) => name)).to.deep.equal([
      'identifiedAsset',
      'downloading',
      'symlinked',
      'downloaded',
    ]);
  });

  it('emits the expected progress events when the latest version is already installed', async () => {
    await javaAssetDownloader.installLatestJavaJar();
    progressReporter.messages = [];

    await javaAssetDownloader.installLatestJavaJar();
    expect(progressReporter.messages.map(({ name }) => name)).to.deep.equal([
      'identifiedAsset',
      'upToDate',
    ]);
  });

  it('downloads the latest jar', async () => {
    expect(agentDir).to.not.be.a.path();

    await javaAssetDownloader.installLatestJavaJar();

    expect(path.join(agentDir, archiveName)).to.be.a.file().with.content(agentJarContents);
    expect(agentSymlinkPath).to.be.a.file().with.content(agentJarContents);
  });

  it("updates to the latest jar if `latest` differs from what's on disk", async () => {
    await javaAssetDownloader.installLatestJavaJar();
    expect(path.join(agentDir, archiveName)).to.be.a.file().with.content(agentJarContents);

    archiveName = 'appmap-0.0.1.jar';
    await javaAssetDownloader.installLatestJavaJar();
    expect(path.join(agentDir, archiveName)).to.be.a.file().with.content(agentJarContents);
  });

  it('creates and updates symlinks to the latest jar', async () => {
    await javaAssetDownloader.installLatestJavaJar();
    expect(await realpath(agentSymlinkPath)).to.equal(path.join(agentDir, archiveName));

    archiveName = 'appmap-0.0.1.jar';
    await javaAssetDownloader.installLatestJavaJar();
    expect(await realpath(agentSymlinkPath)).to.equal(path.join(agentDir, archiveName));
  });
});
