import '../mock/vscode';

import { expect } from 'chai';
import { execFileSync } from 'child_process';
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Sinon from 'sinon';

import {
  cliIgnoredPaths,
  filterConfigFiles,
  gitIgnoredPaths,
  isInExcludedDirectory,
  repositoryRoot,
} from '../../../src/services/configFileFilter';

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
    const fakeRepository = (rootPath: string, ignored: string[] | Error) => ({
      rootUri: { fsPath: rootPath },
      checkIgnore: Sinon.stub().callsFake(async (paths: string[]) => {
        if (ignored instanceof Error) throw ignored;
        return new Set(paths.filter((p) => ignored.includes(p)));
      }),
    });

    it('asks the Git extension for paths in a repository it has open', async () => {
      const repository = fakeRepository(project, [join(project, 'build', 'appmap.yml')]);
      const api = { repositories: [repository] };
      const ignored = await gitIgnoredPaths(
        [join(project, 'appmap.yml'), join(project, 'build', 'appmap.yml')],
        api
      );
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
      expect(repository.checkIgnore.calledOnce).to.be.true;
    });

    it('falls back to the git command line when the Git extension has no repository', async () => {
      gitInit();
      const api = { repositories: [] };
      const ignored = await gitIgnoredPaths(
        [join(project, 'appmap.yml'), join(project, 'build', 'appmap.yml')],
        api
      );
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('falls back to the git command line when the Git extension fails', async () => {
      gitInit();
      const repository = fakeRepository(project, new Error('git check-ignore failed'));
      const api = { repositories: [repository] };
      const ignored = await gitIgnoredPaths([join(project, 'build', 'appmap.yml')], api);
      expect([...ignored]).to.deep.equal([join(project, 'build', 'appmap.yml')]);
    });

    it('combines the answers of every enclosing repository', async () => {
      gitInit(project);
      gitInit(root);
      await writeFile(join(root, '.gitignore'), 'project/apps/\n');
      // The Git extension has only the inner repository open; the outer one is asked via git.
      const inner = fakeRepository(project, [join(project, 'build', 'appmap.yml')]);
      const ignored = await gitIgnoredPaths(
        [
          join(project, 'appmap.yml'),
          join(project, 'apps', 'client', 'appmap.yml'),
          join(project, 'build', 'appmap.yml'),
        ],
        { repositories: [inner] }
      );
      expect([...ignored]).to.have.members([
        join(project, 'apps', 'client', 'appmap.yml'),
        join(project, 'build', 'appmap.yml'),
      ]);
    });

    it('reports nothing for paths outside any repository', async () => {
      const ignored = await gitIgnoredPaths([join(project, 'build', 'appmap.yml')], undefined);
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

    it('reports nothing for an empty list without running git', async () => {
      expect((await cliIgnoredPaths('/definitely/not/a/dir', [])).size).to.equal(0);
    });
  });
});
