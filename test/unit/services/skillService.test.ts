import '../mock/vscode';
import Sinon from 'sinon';
import nock from 'nock';
import os, { tmpdir } from 'os';
import { existsSync } from 'node:fs';
import { lstat, mkdir, mkdtemp, readFile, readlink, rm, writeFile } from 'node:fs/promises';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import { join } from 'node:path';
import * as tar from 'tar';
import * as vscode from 'vscode';
import lockfile from 'proper-lockfile';

import { GithubReleaseCache } from '../../../src/assets';
import Environment from '../../../src/configuration/environment';
import SkillService from '../../../src/services/skillService';
import downloadHttpRetry from '../../../src/assets/downloadHttpRetry';
import { waitFor } from '../../waitFor';

chai.use(chaiFs);

const REPO = 'getappmap/skills';

// Build a GitHub-style source tarball: a single top-level `skills-<version>/`
// directory, which the cache strips.
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
  GithubReleaseCache.clear();
  nock('https://api.github.com')
    .get(`/repos/${REPO}/releases`)
    .reply(200, [{ tag_name: `v${version}` }]);
  nock('https://github.com')
    .get(`/${REPO}/archive/refs/tags/v${version}.tar.gz`)
    .reply(200, await buildTarball(version, skills));
}

function setSetting(key: string, value: unknown) {
  return vscode.workspace.getConfiguration('appMap').update(key, value);
}

function memento(state: Map<string, unknown>): vscode.Memento {
  return {
    get: (key: string) => state.get(key),
    update: async (key: string, value: unknown) => void state.set(key, value),
  } as unknown as vscode.Memento;
}

// Registers the service with in-memory state, and hands both mementos back so
// a test can seed or inspect them.
function registerService(): {
  globalState: Map<string, unknown>;
  workspaceState: Map<string, unknown>;
} {
  const globalState = new Map<string, unknown>();
  const workspaceState = new Map<string, unknown>();
  SkillService.register({
    subscriptions: [],
    globalState: memento(globalState),
    workspaceState: memento(workspaceState),
  } as unknown as vscode.ExtensionContext);
  return { globalState, workspaceState };
}

describe('SkillService', () => {
  let homeDir: string;
  let claudeSkills: string;
  let agentsSkills: string;
  let cache: string;
  let globalState: Map<string, unknown>;

  beforeEach(async () => {
    // The service keeps its state statically, so re-register for every test.
    ({ globalState } = registerService());
    homeDir = await mkdtemp(join(tmpdir(), 'vscode-appland-skills-test-'));
    Sinon.stub(os, 'homedir').returns(homeDir);
    Sinon.stub(process, 'platform').value('linux');
    claudeSkills = join(homeDir, '.claude', 'skills');
    agentsSkills = join(homeDir, '.agents', 'skills');
    cache = join(homeDir, '.appmap', 'skills');
    downloadHttpRetry.maxTries = 1;
  });

  afterEach(async () => {
    Sinon.restore();
    nock.cleanAll();
    GithubReleaseCache.clear();
    await setSetting('skills.install', undefined);
    await setSetting('skills.directories', undefined);
    await rm(homeDir, { recursive: true });
    downloadHttpRetry.maxTries = 3;
  });

  describe('when installation is enabled (the default)', () => {
    it('unpacks the release into the cache and links each skill into every directory', async () => {
      await mockRelease('1.0.0', ['appmap-record', 'appmap-review']);

      await SkillService.ensureInstalled(true);

      expect(join(cache, '.version')).to.be.a.file().with.content('1.0.0');
      expect(join(cache, 'appmap-record', 'SKILL.md'))
        .to.be.a.file()
        .with.content('appmap-record 1.0.0');
      for (const dir of [claudeSkills, agentsSkills]) {
        for (const skill of ['appmap-record', 'appmap-review']) {
          const link = join(dir, skill);
          expect((await lstat(link)).isSymbolicLink()).to.be.true;
          expect(await readlink(link)).to.equal(join(cache, skill));
        }
      }
    });

    it('respects the configured skills directories', async () => {
      await setSetting('skills.directories', ['~/.copilot/skills', join(homeDir, 'elsewhere')]);
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(join(homeDir, '.copilot', 'skills', 'appmap-record')).to.be.a.path();
      expect(join(homeDir, 'elsewhere', 'appmap-record')).to.be.a.path();
      expect(claudeSkills).to.not.be.a.path();
    });

    // An empty directory list is how someone who wants to place the skills
    // themselves keeps the cache current without us touching any agent.
    it('keeps the cache up to date and links nowhere when no directories are configured', async () => {
      await setSetting('skills.directories', []);
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(join(cache, 'appmap-record', 'SKILL.md')).to.be.a.file();
      expect(claudeSkills).to.not.be.a.path();
      expect(agentsSkills).to.not.be.a.path();
    });

    it('ignores directories in the release that have no SKILL.md', async () => {
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(claudeSkills).to.be.a.directory().with.contents(['appmap-record', '.appmap-skills']);
    });

    it('does not download again when the cached version is current', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      GithubReleaseCache.clear();
      nock('https://api.github.com')
        .get(`/repos/${REPO}/releases`)
        .reply(200, [{ tag_name: 'v1.0.0' }]);
      await SkillService.ensureInstalled(true);

      expect(nock.isDone()).to.be.true;
      expect(join(cache, 'appmap-record', 'SKILL.md')).to.be.a.file();
    });

    it('replaces the cache in place on upgrade so links stay valid', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      await mockRelease('1.1.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      expect(join(cache, '.version')).to.be.a.file().with.content('1.1.0');
      expect(join(claudeSkills, 'appmap-record', 'SKILL.md'))
        .to.be.a.file()
        .with.content('appmap-record 1.1.0');
      expect(join(homeDir, '.appmap')).to.be.a.directory().with.subDirs(['skills']);
    });

    it('removes managed skills that are no longer in the release', async () => {
      await mockRelease('1.0.0', ['appmap-record', 'appmap-retired']);
      await SkillService.ensureInstalled(true);
      expect(join(claudeSkills, 'appmap-retired')).to.be.a.path();

      await mockRelease('1.1.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      expect(join(claudeSkills, 'appmap-retired')).to.not.be.a.path();
      expect(join(cache, 'appmap-retired')).to.not.be.a.path();
    });

    it('does not overwrite a skill directory the user created', async () => {
      await mkdir(join(claudeSkills, 'appmap-record'), { recursive: true });
      await writeFile(join(claudeSkills, 'appmap-record', 'SKILL.md'), 'mine');
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(join(claudeSkills, 'appmap-record', 'SKILL.md')).to.be.a.file().with.content('mine');
      // Other directories are still populated
      expect(join(agentsSkills, 'appmap-record')).to.be.a.path();
    });

    it('does not replace a symlink that points somewhere else', async () => {
      const mine = join(homeDir, 'my-appmap-record');
      await mkdir(mine, { recursive: true });
      await mkdir(claudeSkills, { recursive: true });
      const { symlink } = await import('node:fs/promises');
      await symlink(mine, join(claudeSkills, 'appmap-record'), 'dir');
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(await readlink(join(claudeSkills, 'appmap-record'))).to.equal(mine);
    });

    it('leaves unrelated user skills alone', async () => {
      await mkdir(join(claudeSkills, 'my-skill'), { recursive: true });
      await writeFile(join(claudeSkills, 'my-skill', 'SKILL.md'), 'mine');
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(join(claudeSkills, 'my-skill', 'SKILL.md')).to.be.a.file().with.content('mine');
    });

    it('does not depend on the AppMap tools lock', async () => {
      // The tool updater locks ~/.appmap. A concurrent skills update must not
      // mistake that for another process doing its work.
      const appmapDir = join(homeDir, '.appmap');
      await mkdir(appmapDir, { recursive: true });
      const release = await lockfile.lock(appmapDir);
      try {
        await mockRelease('1.0.0', ['appmap-record']);
        await SkillService.ensureInstalled(true);
        expect(join(claudeSkills, 'appmap-record')).to.be.a.path();
      } finally {
        await release();
      }
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

    it('leaves the cache untouched when the release contains no skills', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      await mockRelease('1.1.0', []);
      let err: Error | undefined;
      try {
        await SkillService.ensureInstalled(true);
      } catch (e) {
        err = e as Error;
      }

      expect(err?.message).to.match(/contains no skills/);
      expect(join(cache, '.version')).to.be.a.file().with.content('1.0.0');
      expect(join(cache, 'appmap-record', 'SKILL.md')).to.be.a.file();
    });
  });

  describe('when symlinks are unavailable', () => {
    beforeEach(() => {
      // `require` rather than a namespace import: esModuleInterop copies the
      // namespace object, so stubbing the copy wouldn't affect the real module.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fsPromises = require('node:fs/promises');
      Sinon.stub(fsPromises, 'symlink').rejects(new Error('EPERM'));
    });

    it('copies the skill and stamps it with the version', async () => {
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      const installed = join(claudeSkills, 'appmap-record');
      expect((await lstat(installed)).isDirectory()).to.be.true;
      expect(join(installed, 'SKILL.md')).to.be.a.file().with.content('appmap-record 1.0.0');
      expect(join(installed, '.appmap-skill')).to.be.a.file().with.content('1.0.0');
    });

    it('refreshes the copy on upgrade', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      await mockRelease('1.1.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      const installed = join(claudeSkills, 'appmap-record');
      expect(join(installed, 'SKILL.md')).to.be.a.file().with.content('appmap-record 1.1.0');
      expect(join(installed, '.appmap-skill')).to.be.a.file().with.content('1.1.0');
    });
  });

  describe('workspace MCP configuration', () => {
    let prompt: Sinon.SinonStub;
    const folder = () => join(homeDir, 'project');
    const mcpJson = () => join(folder(), '.vscode', 'mcp.json');

    beforeEach(async () => {
      await mkdir(folder(), { recursive: true });
      Sinon.stub(vscode.workspace, 'workspaceFolders').value([
        { uri: { fsPath: folder() }, name: 'project' },
      ]);
      prompt = Sinon.stub(vscode.window, 'showInformationMessage');
      // The install notification has already been shown, so the only
      // notification these tests can see is the MCP one.
      globalState.set('appMap.skills.installNotified', true);
      await mockRelease('1.0.0', ['appmap-record']);
    });

    it('adds the server when the user agrees', async () => {
      prompt.resolves('Add');

      await SkillService.ensureInstalled(true);

      expect(prompt.calledOnce).to.be.true;
      expect(prompt.firstCall.args[0]).to.include('project');
      const config = JSON.parse(await readFile(mcpJson(), 'utf8'));
      expect(config.servers.appmap).to.deep.equal({
        type: 'stdio',
        command: 'appmap',
        args: ['query', 'mcp'],
      });
    });

    it('asks again next time when the user dismisses', async () => {
      prompt.resolves('Not now');

      await SkillService.ensureInstalled(true);
      await SkillService.ensureInstalled(true);

      expect(prompt.calledTwice).to.be.true;
      expect(mcpJson()).to.not.be.a.path();
    });

    it('stops asking for a workspace when the user declines for good', async () => {
      prompt.resolves("Don't ask again");

      await SkillService.ensureInstalled(true);
      await SkillService.ensureInstalled(true);

      expect(prompt.calledOnce).to.be.true;
      expect(mcpJson()).to.not.be.a.path();
    });

    it('does not ask when the workspace already lists an appmap server', async () => {
      await mkdir(join(folder(), '.vscode'));
      await writeFile(mcpJson(), '{ "servers": { "appmap": { "command": "/my/appmap" } } }');

      await SkillService.ensureInstalled(true);

      expect(prompt.called).to.be.false;
    });

    // The MCP server stands on its own: .vscode/mcp.json is read by Copilot in
    // VS Code, which needs no agent skills, and by any other MCP client.
    it('asks even when skills installation is disabled', async () => {
      await setSetting('skills.install', false);
      prompt.resolves('Add');

      await SkillService.ensureInstalled(true);

      expect(prompt.calledOnce).to.be.true;
      expect(mcpJson()).to.be.a.file();
      expect(cache).to.not.be.a.path();
    });

    // A notification with buttons on it stays up until the user deals with it,
    // so the skills one must not be in front of this in a queue.
    it('asks while the skills notification is still waiting to be answered', async () => {
      globalState.delete('appMap.skills.installNotified');
      const unanswered = new Promise<string | undefined>(() => undefined);
      prompt.callsFake((message: string) =>
        message.includes('installed its agent skills') ? unanswered : Promise.resolve('Add')
      );

      void SkillService.ensureInstalled();
      await waitFor('the skills notification to appear', () =>
        prompt.getCalls().some((c) => String(c.args[0]).includes('installed its agent skills'))
      );
      // It is now sitting there unanswered, and the MCP offer still arrives.
      await waitFor('the MCP server to be offered', () => existsSync(mcpJson()));
    });
  });

  describe('when installation is disabled', () => {
    it('does nothing', async () => {
      await setSetting('skills.install', false);

      await SkillService.ensureInstalled(true);

      expect(claudeSkills).to.not.be.a.path();
      expect(cache).to.not.be.a.path();
    });
  });

  describe('the note left in the skills directory', () => {
    const note = () => join(claudeSkills, '.appmap-skills');

    it('names the skills it installed and how to be rid of them', async () => {
      await mockRelease('1.0.0', ['appmap-record', 'appmap-review']);

      await SkillService.ensureInstalled(true);

      const contents = await readFile(note(), 'utf8');
      expect(contents).to.include('appmap-record').and.include('appmap-review');
      expect(contents).to.include('~/.appmap/skills');
      expect(contents).to.include('"appMap.skills.install": false');
    });

    it('follows the release as skills come and go', async () => {
      await mockRelease('1.0.0', ['appmap-record', 'appmap-retired']);
      await SkillService.ensureInstalled(true);

      await mockRelease('1.1.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      expect(await readFile(note(), 'utf8')).to.include('appmap-record');
      expect(await readFile(note(), 'utf8')).to.not.include('appmap-retired');
    });

    it('goes away once no skills of ours are left', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);
      expect(note()).to.be.a.file();

      const notify: Sinon.SinonStub = Sinon.stub(vscode.window, 'showInformationMessage');
      const confirm: Sinon.SinonStub = Sinon.stub(vscode.window, 'showWarningMessage');
      notify.resolves('Uninstall');
      confirm.resolves('Remove');
      globalState.delete('appMap.skills.installNotified');
      await SkillService.ensureInstalled(true);

      expect(note()).to.not.be.a.path();
      expect(claudeSkills).to.be.a.directory().and.empty;
    });

    it('is not mistaken for a skill and swept away on the next update', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      await mockRelease('1.1.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      expect(note()).to.be.a.file();
    });
  });

  describe('the first-install notification', () => {
    let notify: Sinon.SinonStub;
    let confirm: Sinon.SinonStub;
    const record = () => join(claudeSkills, 'appmap-record');

    beforeEach(() => {
      notify = Sinon.stub(vscode.window, 'showInformationMessage');
      confirm = Sinon.stub(vscode.window, 'showWarningMessage');
    });

    it('tells the user what was installed and where', async () => {
      notify.resolves('OK');
      await mockRelease('1.0.0', ['appmap-record']);

      await SkillService.ensureInstalled(true);

      expect(notify.calledOnce).to.be.true;
      // The home directory is abbreviated rather than spelled out.
      expect(notify.firstCall.args[0])
        .to.include('~/.claude/skills')
        .and.include('~/.agents/skills');
      // The first button does nothing at all.
      expect(notify.firstCall.args[1]).to.equal('OK');
      expect(record()).to.be.a.path();
    });

    it('does not tell the user again', async () => {
      await mockRelease('1.0.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      await mockRelease('1.1.0', ['appmap-record']);
      await SkillService.ensureInstalled(true);

      expect(notify.calledOnce).to.be.true;
    });

    it('stays quiet when nothing was installed', async () => {
      // The release can't be resolved, so no skills land on disk.
      nock('https://api.github.com').get(`/repos/${REPO}/releases`).reply(403);

      await SkillService.ensureInstalled();

      expect(notify.called).to.be.false;
      // ...and the user is still told about the next, successful install.
      expect(globalState.get('appMap.skills.installNotified')).to.be.undefined;
    });

    describe('when the user asks to uninstall', () => {
      beforeEach(async () => {
        notify.resolves('Uninstall');
        await mockRelease('1.0.0', ['appmap-record']);
      });

      it('confirms, then removes the skills and turns installation off', async () => {
        confirm.resolves('Remove');
        await mkdir(join(claudeSkills, 'my-skill'), { recursive: true });

        await SkillService.ensureInstalled(true);

        expect(confirm.calledOnce).to.be.true;
        expect(record()).to.not.be.a.path();
        expect(join(agentsSkills, 'appmap-record')).to.not.be.a.path();
        expect(vscode.workspace.getConfiguration('appMap').get('skills.install')).to.equal(false);
        // Skills the user put there are none of our business.
        expect(join(claudeSkills, 'my-skill')).to.be.a.path();
      });

      it('spells out what is lost, and keeps the skills if the user backs out', async () => {
        confirm.resolves('Keep them');

        await SkillService.ensureInstalled(true);

        expect(confirm.firstCall.args[0]).to.match(/no longer know how to record AppMaps/);
        // The safe choice comes first, for anyone clicking by reflex.
        expect(confirm.firstCall.args[1]).to.equal('Keep them');
        expect(record()).to.be.a.path();
        expect(vscode.workspace.getConfiguration('appMap').get('skills.install')).to.be.undefined;
      });

      it('keeps the skills when the confirmation is dismissed', async () => {
        confirm.resolves(undefined);

        await SkillService.ensureInstalled(true);

        expect(record()).to.be.a.path();
      });
    });
  });

  describe('when running an integration test', () => {
    // The extension test host runs against the real home directory, so
    // installing would reach into whoever's ~/.claude is running the suite.
    it('does nothing even though installation is enabled', async () => {
      Sinon.stub(Environment, 'isIntegrationTest').value(true);

      await SkillService.ensureInstalled(true);

      expect(claudeSkills).to.not.be.a.path();
      expect(cache).to.not.be.a.path();
    });
  });
});
