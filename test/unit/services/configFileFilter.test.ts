import '../mock/vscode';

import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

import {
  cliIgnoredPaths,
  filterConfigFiles,
  gitIgnoredPaths,
  GIT_OPTIONS,
  isInExcludedDirectory,
  repositoryRoot,
} from '../../../src/services/configFileFilter';
import { mockExtension, resetExtensionMocks } from '../mock/vscode/extensions';

describe('configFileFilter', () => {
  let root: string;
  let project: string;

  // Layout, mirroring a package manager that links workspace packages into node_modules:
  //
  //   project/appmap.yml
  //   project/apps/client/appmap.yml
  //   project/node_modules/@scope/client -> ../../apps/client      (dependency link)
  //   project/apps/client-link           -> client                 (plain link)
  //   project/build/appmap.yml                                     (git ignored)
  //   project/.gitignore                 "build/"
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'config-filter-')));
    project = join(root, 'project');
    await mkdir(join(project, 'apps', 'client'), { recursive: true });
    await mkdir(join(project, 'node_modules', '@scope'), { recursive: true });
    await mkdir(join(project, 'build'), { recursive: true });
    await writeFile(join(project, 'appmap.yml'), 'name: root');
    await writeFile(join(project, 'apps', 'client', 'appmap.yml'), 'name: client');
    await writeFile(join(project, 'build', 'appmap.yml'), 'name: build');
    await symlink(
      join('..', '..', 'apps', 'client'),
      join(project, 'node_modules', '@scope', 'client')
    );
    await symlink('client', join(project, 'apps', 'client-link'));
    await writeFile(join(project, '.gitignore'), 'build/\n');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const gitInit = (dir = project) =>
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore' });

  const candidates = () => [
    join(project, 'appmap.yml'),
    join(project, 'apps', 'client', 'appmap.yml'),
    join(project, 'apps', 'client-link', 'appmap.yml'),
    join(project, 'node_modules', '@scope', 'client', 'appmap.yml'),
    join(project, 'build', 'appmap.yml'),
  ];

  const noGit = {
    realpath,
    gitIgnored: async () => new Set<string>(),
  };

  describe('isInExcludedDirectory', () => {
    it('is true for paths under node_modules, a virtualenv, or a VCS directory', () => {
      expect(isInExcludedDirectory('/w', '/w/node_modules/pkg/appmap.yml')).to.be.true;
      expect(isInExcludedDirectory('/w', '/w/a/b/node_modules/pkg/appmap.yml')).to.be.true;
      expect(isInExcludedDirectory('/w', '/w/.venv/lib/appmap.yml')).to.be.true;
      expect(isInExcludedDirectory('/w', '/w/.git/appmap.yml')).to.be.true;
    });

    it('is false for ordinary project paths', () => {
      expect(isInExcludedDirectory('/w', '/w/appmap.yml')).to.be.false;
      expect(isInExcludedDirectory('/w', '/w/apps/client/appmap.yml')).to.be.false;
      // A folder merely named like a dependency directory elsewhere in the name is fine.
      expect(isInExcludedDirectory('/w', '/w/my_node_modules_tool/appmap.yml')).to.be.false;
    });
  });

  describe('filterConfigFiles', () => {
    it('drops config files under node_modules', async () => {
      const kept = await filterConfigFiles(project, candidates(), noGit);
      expect(kept.some((p) => p.includes('node_modules'))).to.be.false;
    });

    it('keeps one path per real file, preferring the shortest', async () => {
      const kept = await filterConfigFiles(project, candidates(), noGit);
      expect(kept).to.not.include(join(project, 'apps', 'client-link', 'appmap.yml'));
      expect(kept).to.include(join(project, 'apps', 'client', 'appmap.yml'));
    });

    it('drops files that git ignores', async () => {
      gitInit();
      const kept = await filterConfigFiles(project, candidates());
      expect(kept).to.have.members([
        join(project, 'appmap.yml'),
        join(project, 'apps', 'client', 'appmap.yml'),
      ]);
    });

    it('judges by the nearest repository, even when the workspace folder is not one', async () => {
      gitInit();
      // The workspace folder is `root`, which holds the repository at `project`.
      const kept = await filterConfigFiles(root, candidates());
      expect(kept).to.not.include(join(project, 'build', 'appmap.yml'));
      expect(kept).to.include(join(project, 'appmap.yml'));
    });

    it('drops a nested repository that an outer repository ignores', async () => {
      // `project` is its own repository, and the repository at `root` ignores it wholesale,
      // the way a demo or a worktree checkout is often laid out. The Explorer grays it out.
      gitInit(project);
      gitInit(root);
      await writeFile(join(root, '.gitignore'), 'project/\n');
      const kept = await filterConfigFiles(root, candidates());
      expect(kept).to.be.empty;
    });

    it('keeps every remaining file when there is no git repository', async () => {
      const kept = await filterConfigFiles(project, candidates());
      expect(kept).to.have.members([
        join(project, 'appmap.yml'),
        join(project, 'apps', 'client', 'appmap.yml'),
        join(project, 'build', 'appmap.yml'),
      ]);
    });

    it('drops files that no longer exist', async () => {
      const kept = await filterConfigFiles(
        project,
        [join(project, 'gone', 'appmap.yml'), join(project, 'appmap.yml')],
        noGit
      );
      expect(kept).to.deep.equal([join(project, 'appmap.yml')]);
    });

    it('keeps a file whose real path cannot be resolved for another reason', async () => {
      const locked = join(project, 'appmap.yml');
      const kept = await filterConfigFiles(project, [locked], {
        realpath: async () => {
          throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
        },
        gitIgnored: noGit.gitIgnored,
      });
      expect(kept).to.deep.equal([locked]);
    });

    it('asks git about real paths, never paths through a symbolic link', async () => {
      const asked: string[][] = [];
      await filterConfigFiles(project, candidates(), {
        realpath,
        gitIgnored: async (paths) => {
          asked.push(paths);
          return new Set();
        },
      });
      expect(asked).to.have.length(1);
      expect(asked[0]).to.have.members([
        join(project, 'appmap.yml'),
        join(project, 'apps', 'client', 'appmap.yml'),
        join(project, 'build', 'appmap.yml'),
      ]);
    });
  });

  describe('gitIgnoredPaths', () => {
    it('reports the paths git ignores', async () => {
      gitInit();
      const ignored = await gitIgnoredPaths(
        [join(project, 'appmap.yml'), join(project, 'build', 'appmap.yml')],
        project
      );
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('combines the answers of the repositories from the file up to the folder', async () => {
      // The workspace folder is the repository at `root`, which holds the one at `project`.
      gitInit(project);
      gitInit(root);
      await writeFile(join(root, '.gitignore'), 'project/apps/\n');
      const ignored = await gitIgnoredPaths(
        [
          join(project, 'appmap.yml'),
          join(project, 'apps', 'client', 'appmap.yml'),
          join(project, 'build', 'appmap.yml'),
        ],
        root
      );
      expect([...ignored]).to.have.members([
        join(project, 'apps', 'client', 'appmap.yml'),
        join(project, 'build', 'appmap.yml'),
      ]);
    });

    it('does not ask a repository outside the one holding the folder', async () => {
      // A worktree or a clone kept in a directory its parent repository ignores, opened as
      // the workspace folder.
      gitInit(project);
      gitInit(root);
      await writeFile(join(root, '.gitignore'), 'project/\n');
      const ignored = await gitIgnoredPaths(
        [join(project, 'appmap.yml'), join(project, 'build', 'appmap.yml')],
        project
      );
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('does not ask the repository holding the folder when it ignores the folder', async () => {
      // A home directory under version control that ignores everything by default, holding
      // a project that is not a repository of its own.
      gitInit(root);
      await writeFile(join(root, '.gitignore'), '*\n');
      const ignored = await gitIgnoredPaths(
        [join(project, 'appmap.yml'), join(project, 'build', 'appmap.yml')],
        project
      );
      expect(ignored.size).to.equal(0);
    });

    it('asks the repository holding the folder when the folder is inside it', async () => {
      // A folder opened inside a larger repository, as with a package in a monorepo.
      gitInit(root);
      await writeFile(join(root, '.gitignore'), 'build/\n');
      const ignored = await gitIgnoredPaths(
        [join(project, 'appmap.yml'), join(project, 'build', 'appmap.yml')],
        project
      );
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('reports nothing for paths outside any repository', async () => {
      const ignored = await gitIgnoredPaths([join(project, 'build', 'appmap.yml')], project);
      expect(ignored.size).to.equal(0);
    });
  });

  describe('repositoryRoot', () => {
    it('finds the nearest repository root', async () => {
      gitInit();
      expect(await repositoryRoot(join(project, 'apps', 'client'))).to.equal(project);
    });

    it('is undefined outside a repository', async () => {
      expect(await repositoryRoot(project)).to.be.undefined;
    });
  });

  describe('cliIgnoredPaths', () => {
    it('reports the ignored subset', async () => {
      gitInit();
      const ignored = await cliIgnoredPaths(project, [
        join(project, 'appmap.yml'),
        join(project, 'build', 'appmap.yml'),
      ]);
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('reports nothing when no path is ignored', async () => {
      gitInit();
      expect((await cliIgnoredPaths(project, [join(project, 'appmap.yml')])).size).to.equal(0);
    });

    it('still answers for the other paths when one is inside a submodule', async () => {
      const library = join(root, 'library');
      await mkdir(library);
      execFileSync('git', ['init', '-q'], { cwd: library, stdio: 'ignore' });
      execFileSync(
        'git',
        [
          '-c',
          'user.name=t',
          '-c',
          'user.email=t@example.com',
          'commit',
          '-q',
          '--allow-empty',
          '-m',
          'i',
        ],
        { cwd: library, stdio: 'ignore' }
      );
      gitInit();
      execFileSync(
        'git',
        ['-c', 'protocol.file.allow=always', 'submodule', '-q', 'add', library, 'sub'],
        { cwd: project, stdio: 'ignore' }
      );
      await writeFile(join(project, 'sub', 'appmap.yml'), 'name: sub');

      const ignored = await cliIgnoredPaths(project, [
        join(project, 'appmap.yml'),
        join(project, 'sub', 'appmap.yml'),
        join(project, 'build', 'appmap.yml'),
      ]);
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('reports nothing for an empty list without running git', async () => {
      expect((await cliIgnoredPaths('/definitely/not/a/dir', [])).size).to.equal(0);
    });
  });

  describe('with GIT_DIR and GIT_WORK_TREE set', () => {
    const saved = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };

    afterEach(() => {
      for (const [name, value] of Object.entries(saved))
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
    });

    it('judges each path by its own repositories, not the one they point at', async () => {
      // An unrelated repository that ignores nothing, named in the environment.
      const elsewhere = join(root, 'elsewhere');
      await mkdir(elsewhere);
      execFileSync('git', ['init', '-q'], { cwd: elsewhere, stdio: 'ignore' });
      gitInit();
      process.env.GIT_DIR = join(elsewhere, '.git');
      process.env.GIT_WORK_TREE = elsewhere;

      expect(await repositoryRoot(join(project, 'apps'))).to.equal(project);
      const ignored = await gitIgnoredPaths([join(project, 'build', 'appmap.yml')], project);
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });
  });

  describe('a git that names a root elsewhere', () => {
    let savedPath: string | undefined;

    // A git that names the same unrelated directory as the root, wherever it is asked.
    beforeEach(async function () {
      if (process.platform === 'win32') this.skip();
      const bin = join(root, 'bin');
      await mkdir(bin);
      await writeFile(join(bin, 'git'), `#!/bin/sh\necho ${join(root, 'elsewhere')}\n`, {
        mode: 0o755,
      });
      savedPath = process.env.PATH;
      process.env.PATH = `${bin}:${savedPath}`;
    });

    afterEach(() => {
      if (process.platform === 'win32') return;
      process.env.PATH = savedPath;
    });

    it('is not followed', async () => {
      const ignored = await gitIgnoredPaths([join(project, 'build', 'appmap.yml')], project);
      expect(ignored.size).to.equal(0);
    });
  });

  describe('a git that cannot even be spawned', () => {
    afterEach(() => resetExtensionMocks());

    it('counts as no git at all', async () => {
      gitInit();
      // A git path that makes spawning throw rather than fail through the callback, as a
      // git.path naming a .cmd file does on Windows.
      mockExtension('vscode.git', {
        enabled: true,
        getAPI: () => ({ git: { path: 'git\0' } }),
      } as never);
      const kept = await filterConfigFiles(project, candidates());
      expect(kept).to.include(join(project, 'build', 'appmap.yml'));
    });
  });

  describe('a git that hangs', () => {
    let savedPath: string | undefined;
    let savedTimeout: number;

    // Put a git that never answers first on the PATH, and give up on it quickly.
    beforeEach(async function () {
      if (process.platform === 'win32') this.skip();
      const bin = join(root, 'bin');
      await mkdir(bin);
      // Deaf to SIGTERM, as a git stuck in uninterruptible I/O is deaf to every signal.
      await writeFile(join(bin, 'git'), "#!/bin/sh\ntrap '' TERM\nexec sleep 10\n", {
        mode: 0o755,
      });
      savedPath = process.env.PATH;
      process.env.PATH = `${bin}:${savedPath}`;
      savedTimeout = GIT_OPTIONS.timeout;
      GIT_OPTIONS.timeout = 200;
    });

    afterEach(() => {
      if (process.platform === 'win32') return;
      process.env.PATH = savedPath;
      GIT_OPTIONS.timeout = savedTimeout;
    });

    it('is given up on, and nothing counts as ignored', async () => {
      const path = join(project, 'build', 'appmap.yml');
      const started = Date.now();
      expect((await gitIgnoredPaths([path], project)).size).to.equal(0);
      expect(await repositoryRoot(project)).to.be.undefined;
      expect(Date.now() - started).to.be.below(5_000);
    });
  });
});
