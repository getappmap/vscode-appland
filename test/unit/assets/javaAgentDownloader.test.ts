import '../mock/vscode';

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import os, { tmpdir } from 'os';

import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';

import Sinon from 'sinon';
import { Uri } from 'vscode';

import { BundledFileDownloadUrlResolver, cacheDir, JavaAgentDownloader } from '../../../src/assets';
import ResourceVersions from '../../../resources/versions.json';
import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';
import mockAssetApis, { JAVA_AGENT_GITHUB_BODY, JAVA_AGENT_MAVEN_BODY } from './mockAssetApis';

chai.use(chaiFs);

describe('JavaAgentDownloader', () => {
  it('downloads the Java agent to the expected location', async () => {
    await JavaAgentDownloader();

    expect(cache).to.be.a.directory().with.files(['appmap-0.0.0-TEST.jar']);

    expect(join(cache, 'appmap-0.0.0-TEST.jar')).to.be.a.file().with.content(JAVA_AGENT_MAVEN_BODY);
  });

  // Reproduces a customer report: a corporate proxy answers 403 for Maven
  // Central. Their version lookup still succeeded, which is the tell -- the
  // version chain already falls through, because each resolver makes a real
  // request. The download chain didn't: MavenDownloadUrlResolver builds its
  // URL by string interpolation and always returned one, so the GitHub
  // resolver after it was unreachable dead code.
  it('falls back to GitHub releases when Maven Central is blocked', async () => {
    mockAssetApis.restore();
    // A stable version, because GitHubReleaseResolver skips prerelease tags
    // and here it has to resolve the version as well as serve the download.
    mockAssetApis({ javaAgent: '1.2.3', denylist: ['repo1.maven.org'] });

    await JavaAgentDownloader();

    expect(join(cache, 'appmap-1.2.3.jar')).to.be.a.file().with.content(JAVA_AGENT_GITHUB_BODY);
  });

  // The narrower shape, and the one a probe can't catch: the proxy lets
  // maven-metadata.xml through, so Maven wins version resolution and would
  // answer a probe, but refuses the jar itself.
  it('falls back to GitHub releases when only the Maven artifact is blocked', async () => {
    mockAssetApis.restore();
    mockAssetApis({ denylist: ['appmap-agent-'] });

    await JavaAgentDownloader();

    expect(join(cache, 'appmap-0.0.0-TEST.jar'))
      .to.be.a.file()
      .with.content(JAVA_AGENT_GITHUB_BODY);
  });

  // Maven Central repackages the agent under its artifactId, so this is the
  // name the IntelliJ plugin writes into the directory we read. Recognizing
  // it is what stops us downloading a jar that's already on disk.
  it('reuses a jar the IntelliJ plugin downloaded under the Maven name', async () => {
    await mkdir(javaDir, { recursive: true });
    await writeFile(join(javaDir, 'appmap-agent-0.0.0-TEST.jar'), 'FROM_INTELLIJ');

    await JavaAgentDownloader();

    expect(join(javaDir, 'appmap.jar')).to.be.a.file().with.content('FROM_INTELLIJ');
    expect(cache).not.to.be.a.path();
  });

  // The plugin downloads straight to the final path instead of staging a
  // temporary file, marking the download in flight with a .downloading lock.
  // Linking appmap.jar at a half-written jar would hand the JVM a broken
  // -javaagent.
  it('ignores a jar the IntelliJ plugin is still downloading', async () => {
    await mkdir(javaDir, { recursive: true });
    await writeFile(join(javaDir, 'appmap-agent-0.0.0-TEST.jar'), 'HALF_WRITTEN');
    await writeFile(join(javaDir, 'appmap-agent-0.0.0-TEST.jar.downloading'), '');

    await JavaAgentDownloader();

    // we fetched our own copy rather than linking the partial file
    expect(join(javaDir, 'appmap.jar')).to.be.a.file().with.content(JAVA_AGENT_MAVEN_BODY);
    expect(join(cache, 'appmap-0.0.0-TEST.jar')).to.be.a.file();
  });

  it('throws naming every source once they have all failed', async () => {
    mockAssetApis.restore();
    mockAssetApis({ denylist: ['appmap-agent-', 'appmap-java/releases/download'] });

    let err: Error | undefined;
    try {
      await JavaAgentDownloader();
    } catch (e) {
      err = e as Error;
    }

    expect(err?.message).to.match(/Failed to download the AppMap Java agent/);
    expect(err?.message).to.include('repo1.maven.org');
    expect(err?.message).to.include('github.com');
    // no partial downloads left behind by the sources that refused us
    expect(cache).to.be.a.directory().and.empty;
  });

  it('does not download if the same version is bundled', async () => {
    const bundledDir = join(homeDir, 'resources');
    await mkdir(bundledDir, { recursive: true });
    await writeFile(join(bundledDir, 'appmap-0.0.1-TEST.jar'), 'BUNDLED');

    await JavaAgentDownloader();

    // The target should not be replaced
    expect(join(homeDir, '.appmap', 'lib', 'java', 'appmap.jar'))
      .to.be.a.file()
      .with.content('BUNDLED');

    // the cache should remain empty
    expect(cache).not.to.be.a.path();
  });

  let homeDir: string;
  let cache: string;
  let javaDir: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-appmap-download-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    BundledFileDownloadUrlResolver.extensionDirectory = homeDir;
    cache = cacheDir();
    javaDir = join(homeDir, '.appmap', 'lib', 'java');
    downloadHttpRetry.maxTries = 1; // don't retry, we're testing fallbacks
    mockAssetApis();
  });
  afterEach(() => {
    Sinon.restore();
    mockAssetApis.restore();
    downloadHttpRetry.maxTries = 3;
  });
});

describe('BundledFileDownloadUrlResolver', () => {
  // build/updateResources.js writes resources/appmap-<version>.jar, so a
  // resolver keyed on 'appmap-java.jar' must not also look for that filename.
  it('resolves a bundled file whose name differs from its versions.json key', async () => {
    Sinon.stub(BundledFileDownloadUrlResolver, 'extensionDirectory').value('/ext');
    const version = ResourceVersions['appmap-java.jar'];
    const resolver = new BundledFileDownloadUrlResolver(
      'appmap-java.jar',
      (v) => `appmap-${v}.jar`
    );

    expect(await resolver.getDownloadUrl(version)).to.equal(
      Uri.file(join('/ext', 'resources', `appmap-${version}.jar`)).toString()
    );
    expect(await resolver.getDownloadUrl('99.99.99')).to.be.undefined;
  });

  afterEach(() => Sinon.restore());
});
