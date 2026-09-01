import '../mock/vscode';
import Sinon from 'sinon';
import nock from 'nock';
import os, { tmpdir } from 'os';
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'node:path';
import * as tar from 'tar';
import * as vscode from 'vscode';

import { GithubReleaseCache } from '../../../src/assets';
import SkillService from '../../../src/services/skillService';
import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';

chai.use(chaiFs);

const REPO = 'getappmap/skills';

// Build a GitHub-style source tarball: a single top-level `skills-<version>/`
// directory, which the downloader strips.
async function buildTarball(version: string, skills: string[]): Promise<Buffer> {
  const stage = await mkdtemp(join(tmpdir(), 'skills-tarball-'));
  const root = join(stage, `skills-${version}`);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'README.md'), 'not a skill');
  for (const skill of skills) {
    await mkdir(join(root, skill), { recursive: true });
    await writeFile(join(root, skill, 'SKILL.md'), `${skill} ${version}`);
  }
  const archive = join(stage, 'archive.tar.gz');
  await tar.create({ file: archive, gzip: true, cwd: stage }, [`skills-${version}`]);
  const buffer = await readFile(archive);
  await rm(stage, { recursive: true, force: true });
  return buffer;
}

async function mockRelease(version: string, skills: string[]) {
  nock('https://api.github.com')
    .get(`/repos/${REPO}/releases`)
    .reply(200, [{ tag_name: `v${version}` }]);
  nock('https://github.com')
    .get(`/${REPO}/archive/refs/tags/v${version}.tar.gz`)
    .reply(200, await buildTarball(version, skills));
}

describe('SkillService', () => {
  let homeDir: string;
  let claudeSkills: string;
  let appmapSkills: string;

  beforeEach(async () => {
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-skills-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    Sinon.stub(process, 'platform').value('linux');
    claudeSkills = join(homeDir, '.claude', 'skills');
    appmapSkills = join(homeDir, '.appmap', 'skills');
    downloadHttpRetry.maxTries = 1;
  });

  afterEach(async () => {
    Sinon.restore();
    nock.cleanAll();
    GithubReleaseCache.clear();
    vscode.workspace.getConfiguration('appMap').update('autoUpdateSkills', undefined);
    await rm(homeDir, { recursive: true });
    downloadHttpRetry.maxTries = 3;
  });

  it('installs each skill as a symlink into the versioned cache', async () => {
    await mockRelease('1.0.0', ['appmap-record', 'appmap-review']);

    await SkillService.ensureInstalled(true);

    expect(join(appmapSkills, '1.0.0', 'appmap-record', 'SKILL.md'))
      .to.be.a.file()
      .with.content('appmap-record 1.0.0');
    for (const skill of ['appmap-record', 'appmap-review']) {
      const link = join(claudeSkills, skill);
      expect((await lstat(link)).isSymbolicLink()).to.be.true;
      expect(await readlink(link)).to.equal(join(appmapSkills, '1.0.0', skill));
    }
  });

  it('ignores directories in the release that have no SKILL.md', async () => {
    await mockRelease('1.0.0', ['appmap-record']);

    await SkillService.ensureInstalled(true);

    expect(claudeSkills).to.be.a.directory().with.contents(['appmap-record']);
  });

  it('upgrades to a new release and removes the old cached version', async () => {
    await mockRelease('1.0.0', ['appmap-record']);
    await SkillService.ensureInstalled(true);

    GithubReleaseCache.clear();
    await mockRelease('1.1.0', ['appmap-record']);
    await SkillService.ensureInstalled(true);

    expect(await readlink(join(claudeSkills, 'appmap-record'))).to.equal(
      join(appmapSkills, '1.1.0', 'appmap-record')
    );
    expect(appmapSkills).to.be.a.directory().with.subDirs(['1.1.0']);
  });

  it('removes managed skills that are no longer in the release', async () => {
    await mockRelease('1.0.0', ['appmap-record', 'appmap-retired']);
    await SkillService.ensureInstalled(true);
    expect(join(claudeSkills, 'appmap-retired')).to.be.a.path();

    GithubReleaseCache.clear();
    await mockRelease('1.1.0', ['appmap-record']);
    await SkillService.ensureInstalled(true);

    expect(join(claudeSkills, 'appmap-retired')).to.not.be.a.path();
  });

  it('does not overwrite a skill directory the user created', async () => {
    await mkdir(join(claudeSkills, 'appmap-record'), { recursive: true });
    await writeFile(join(claudeSkills, 'appmap-record', 'SKILL.md'), 'mine');
    await mockRelease('1.0.0', ['appmap-record']);

    await SkillService.ensureInstalled(true);

    expect(join(claudeSkills, 'appmap-record', 'SKILL.md')).to.be.a.file().with.content('mine');
  });

  it('leaves unrelated user skills alone', async () => {
    await mkdir(join(claudeSkills, 'my-skill'), { recursive: true });
    await writeFile(join(claudeSkills, 'my-skill', 'SKILL.md'), 'mine');
    await mockRelease('1.0.0', ['appmap-record']);

    await SkillService.ensureInstalled(true);

    expect(join(claudeSkills, 'my-skill', 'SKILL.md')).to.be.a.file().with.content('mine');
  });

  it('copies instead of symlinking when symlinks are unavailable', async () => {
    await mockRelease('1.0.0', ['appmap-record']);
    // `require` rather than a namespace import: esModuleInterop copies the
    // namespace object, so stubbing the copy wouldn't affect the real module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsPromises = require('node:fs/promises');
    Sinon.stub(fsPromises, 'symlink').rejects(new Error('EPERM'));
    await SkillService.ensureInstalled(true);

    const installed = join(claudeSkills, 'appmap-record');
    expect((await lstat(installed)).isDirectory()).to.be.true;
    expect(join(installed, 'SKILL.md')).to.be.a.file().with.content('appmap-record 1.0.0');
    expect(join(installed, '.appmap-skill')).to.be.a.file().with.content('1.0.0');
  });

  it('does nothing when automatic skill updates are disabled', async () => {
    vscode.workspace.getConfiguration('appMap').update('autoUpdateSkills', false);

    await SkillService.ensureInstalled(true);

    expect(claudeSkills).to.not.be.a.path();
  });

  it('throws when the latest version cannot be resolved', async () => {
    nock('https://api.github.com').get(`/repos/${REPO}/releases`).reply(403);

    let err: Error | undefined;
    try {
      await SkillService.ensureInstalled(true);
    } catch (e) {
      err = e as Error;
    }

    expect(err?.message).to.match(/Error resolving the latest AppMap skills version/);
  });
});
