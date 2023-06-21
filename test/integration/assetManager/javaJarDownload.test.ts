import assert from 'assert';
import { existsSync, lstatSync } from 'fs';
import os from 'os';
import path from 'path';
import { SinonSandbox, createSandbox } from 'sinon';

import { ProjectA, initializeWorkspace, waitFor, waitForExtension } from '../util';
import GithubRelease from '../../../src/lib/githubRelease';

const expectedJavaDir = path.join(ProjectA, '.appmap', 'lib', 'java');
const expectedLatestJarPath = path.join(expectedJavaDir, 'appmap.jar');

describe('asset manager', () => {
  let sinon: SinonSandbox;

  before(async () => {
    sinon = createSandbox();
    sinon.stub(os, 'homedir').returns(ProjectA);

    await waitForExtension();
    await waitFor('Waiting for jar to be downloaded', () => existsSync(expectedLatestJarPath));
  });

  after(async () => {
    sinon.restore();
    await initializeWorkspace();
  });

  it('downloads the latest jar', async () => {
    const release = new GithubRelease('getappmap', 'appmap-java');
    const assets = await release.getLatestAssets();
    const asset = assets.find((a) => a.content_type === 'application/java-archive');
    assert(asset);
    const expectedAssetPath = path.join(expectedJavaDir, asset.name);
    assert(existsSync(expectedAssetPath));
    const stats = lstatSync(expectedAssetPath);
    assert(stats.isFile());
  });

  it('creates a symlink to the latest jar', () => {
    assert(existsSync(expectedLatestJarPath));
    const stats = lstatSync(expectedLatestJarPath);
    assert(stats.isSymbolicLink());
  });
});
