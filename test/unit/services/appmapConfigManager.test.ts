import '../mock/vscode';

import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { appendFile, mkdtemp, mkdir, realpath, rm, symlink, utimes, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Sinon from 'sinon';
import * as vscode from 'vscode';

import { AppmapConfigManagerInstance } from '../../../src/services/appmapConfigManager';
import * as ConfigFileFilter from '../../../src/services/configFileFilter';
import { FileChangeEmitter } from '../../../src/services/fileChangeEmitter';
import { NodeProcessService } from '../../../src/services/nodeProcessService';
import type Watcher from '../../../src/services/watcher';

// A watcher whose events the test fires by hand.
class FakeWatcher extends FileChangeEmitter {
  create(path: string): void {
    this._onCreate.fire(vscode.Uri.file(path));
  }
  change(path: string): void {
    this._onChange.fire(vscode.Uri.file(path));
  }
  delete(path: string): void {
    this._onDelete.fire(vscode.Uri.file(path));
  }
}

describe('AppmapConfigManagerInstance', () => {
  let sinon: Sinon.SinonSandbox;
  let project: string;
  let folder: vscode.WorkspaceFolder;
  let watcher: FakeWatcher;
  let instance: AppmapConfigManagerInstance;
  let changes: number;

  // Wait for every watcher event fired so far to be handled.
  const settled = () => instance['_queue'];

  // Write a file and date it later than anything recorded so far.
  let later = Date.now() / 1000 + 10;
  const rewrite = async (path: string, content: string) => {
    await writeFile(path, content);
    later += 10;
    await utimes(path, later, later);
  };

  //   project/appmap.yml
  //   project/ignored/appmap.yml   (git ignored)
  //   project/.gitignore           "ignored/"
  beforeEach(async () => {
    sinon = Sinon.createSandbox();
    sinon.stub(NodeProcessService.outputChannel, 'appendLine');

    project = await realpath(await mkdtemp(join(tmpdir(), 'config-manager-')));
    await mkdir(join(project, 'ignored'));
    await writeFile(join(project, 'appmap.yml'), 'name: root');
    await writeFile(join(project, 'ignored', 'appmap.yml'), 'name: ignored');
    await writeFile(join(project, '.gitignore'), 'ignored/\n');
    execFileSync('git', ['init', '-q'], { cwd: project });

    folder = { uri: vscode.Uri.file(project), name: 'project', index: 0 };
    sinon.stub(vscode.workspace, 'getWorkspaceFolder').returns(folder);

    watcher = new FakeWatcher();
    instance = await new AppmapConfigManagerInstance(
      watcher as unknown as Watcher,
      folder
    ).initialize();
    changes = 0;
    instance.onConfigChanged(() => changes++);
  });

  afterEach(async () => {
    instance.dispose();
    watcher.dispose();
    sinon.restore();
    await rm(project, { recursive: true, force: true });
  });

  it('finds only the config file git does not ignore', () => {
    expect(instance.workspaceConfigs.map((config) => config.configFolder)).to.deep.equal([project]);
  });

  it('uses every config file found when filtering them fails', async () => {
    sinon.stub(ConfigFileFilter, 'filterConfigFiles').rejects(new Error('unforeseen'));
    const unfiltered = await new AppmapConfigManagerInstance(
      watcher as unknown as Watcher,
      folder
    ).initialize();
    try {
      expect(unfiltered.workspaceConfigs.map((config) => config.configFolder)).to.have.members([
        project,
        join(project, 'ignored'),
      ]);
    } finally {
      unfiltered.dispose();
    }
  });

  it('ignores the creation of a git-ignored config file', async () => {
    watcher.create(join(project, 'ignored', 'appmap.yml'));
    await settled();
    expect(changes).to.equal(0);
  });

  it('ignores the deletion of a git-ignored config file', async () => {
    const ignored = join(project, 'ignored', 'appmap.yml');
    await rm(ignored);
    watcher.delete(ignored);
    await settled();
    expect(changes).to.equal(0);
  });

  it('reports the deletion of a config file it uses', async () => {
    const used = join(project, 'appmap.yml');
    await rm(used);
    watcher.delete(used);
    await settled();
    expect(changes).to.equal(1);
    expect(instance.workspaceConfigs).to.be.empty;
  });

  it('reports a change to a config file it uses', async () => {
    const used = join(project, 'appmap.yml');
    await rewrite(used, 'name: root\nappmap_dir: elsewhere');
    watcher.change(used);
    await settled();
    expect(changes).to.equal(1);
    expect(instance.workspaceConfigs.map((config) => config.appmapDir)).to.deep.equal([
      'elsewhere',
    ]);
  });

  it('reports a config file it uses becoming git-ignored', async () => {
    const used = join(project, 'appmap.yml');
    await appendFile(join(project, '.gitignore'), '/appmap.yml\n');
    await rewrite(used, 'name: root');
    watcher.change(used);
    await settled();
    expect(changes).to.equal(1);
    expect(instance.workspaceConfigs).to.be.empty;
  });

  it('ignores a config file it uses being reported under another name', async () => {
    await mkdir(join(project, 'sub'));
    await writeFile(join(project, 'sub', 'appmap.yml'), 'name: sub');
    await symlink('sub', join(project, 'sub-link'));
    watcher.create(join(project, 'sub', 'appmap.yml'));
    await settled();
    expect(changes).to.equal(1);

    watcher.create(join(project, 'sub-link', 'appmap.yml'));
    await settled();
    expect(changes).to.equal(1);
  });

  it('reports a change of appmap_dir that it saves itself', async () => {
    await instance.saveAppMapDir(project, 'elsewhere');
    expect(changes).to.equal(1);
    expect(instance.workspaceConfigs.map((config) => config.appmapDir)).to.deep.equal([
      'elsewhere',
    ]);
  });

  it('reports a rewrite that keeps the modification time the file had', async () => {
    // As a filesystem with coarse timestamps can make it look.
    const used = join(project, 'appmap.yml');
    const recorded = (instance['_configMtimes'].get(used) as number) / 1000;
    await writeFile(used, 'name: root\nappmap_dir: elsewhere');
    await utimes(used, recorded, recorded);
    await instance['enqueue'](() => instance['resync']());
    expect(changes).to.equal(1);
  });

  it('drops work still queued when it is disposed', async () => {
    const update = sinon.spy(instance as unknown as { update: () => Promise<void> }, 'update');
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    void instance['enqueue'](() => gate);
    const queued = instance['enqueue'](() => instance['resync']());

    instance.dispose();
    release();
    await queued;

    expect(update.called).to.be.false;
  });

  it('does not let polls pile up behind a slow update', async () => {
    const clock = sinon.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    const polled = new AppmapConfigManagerInstance(watcher as unknown as Watcher, folder);
    try {
      await polled.initialize();
      const poll = sinon.spy(polled as unknown as { poll: () => Promise<void> }, 'poll');

      // Hold the queue for ten poll periods.
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const held = polled['enqueue'](() => gate);
      clock.tick(25_000);
      release();
      await held;
      await polled['_queue'];
      expect(poll.callCount).to.equal(1);

      // And polling goes on afterwards.
      clock.tick(2_500);
      await polled['_queue'];
      expect(poll.callCount).to.equal(2);
    } finally {
      polled.dispose();
    }
  });
});
