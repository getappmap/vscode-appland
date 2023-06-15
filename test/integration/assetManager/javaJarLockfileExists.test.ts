import * as vscode from 'vscode';

import assert from 'assert';
import { existsSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { createSandbox } from 'sinon';

import { ProjectA, initializeWorkspace, waitFor, waitForExtension } from '../util';
import GithubRelease from '../../../src/lib/githubRelease';
import { touch } from '../../../src/lib/touch';

const expectedJavaDir = path.join(ProjectA, '.appmap', 'lib', 'java');
const expectedLatestJarPath = path.join(expectedJavaDir, 'appmap.jar');

const fakeOutputChannel = {
  name: '',
  lines: [] as string[],
  appendLine(line: string) {
    this.lines.push(line);
  },
  append() {
    // not implemented
  },
  clear() {
    // not implemented
  },
  dispose() {
    // not implemented
  },
  hide() {
    // not implemented
  },
  replace() {
    // not implemented
  },
  show() {
    // not implemented
  },
};

const sinon = createSandbox();
sinon
  .stub(vscode.window, 'createOutputChannel')
  .withArgs('AppMap: Assets')
  .returns(fakeOutputChannel);

describe('node process service installation with existing lockfile for jar download', () => {
  let assetPath: string;
  let lockfile: string;

  before(async () => {
    await initializeWorkspace();
    sinon.stub(os, 'homedir').returns(ProjectA);

    const release = new GithubRelease('getappmap', 'appmap-java');
    const assets = await release.getLatestAssets();
    const asset = assets.find((a) => a.content_type === 'application/java-archive');
    assert(asset);

    assetPath = path.join(expectedJavaDir, asset.name);
    lockfile = assetPath + '.downloading';
    mkdirSync(path.join(expectedJavaDir), { recursive: true });
    await touch(lockfile);

    await waitForExtension();
    await waitFor('java jar download attempt', () =>
      fakeOutputChannel.lines.some((line) => line.includes('because lockfile already exists'))
    );
  });

  after(async () => {
    sinon.restore();
    await initializeWorkspace();
  });

  it('does not download the latest jar', async () => {
    assert(!existsSync(expectedLatestJarPath));
  });
});
