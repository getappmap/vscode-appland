import { execFile } from 'child_process';
import { realpath as fsRealpath } from 'fs/promises';
import { dirname, isAbsolute, relative } from 'path';
import { getGitApi } from '../lib/git';

// Directories that never hold a project's own appmap.yml, even in a project that does not
// use git. Package managers link workspace packages into node_modules, so without this rule
// one config file can be found several times over. Everything else that a project installs
// or generates is expected to be covered by its .gitignore.
export const EXCLUDED_DIRECTORIES: ReadonlyArray<string> = [
  'node_modules',
  'venv',
  '.venv',
  '.git',
  '.hg',
  '.svn',
  '.yarn',
];

export type ConfigFileFilterDeps = {
  realpath: (path: string) => Promise<string>;
  // Given absolute paths, return the subset that git ignores.
  gitIgnored: (absolutePaths: string[]) => Promise<Set<string>>;
};

export function isInExcludedDirectory(folder: string, filePath: string): boolean {
  const rel = relative(folder, filePath);
  return rel.split(/[\\/]/).some((segment) => EXCLUDED_DIRECTORIES.includes(segment));
}

function run(
  args: string[],
  cwd: string,
  input?: string
): Promise<{ code: number | string; stdout: string }> {
  return new Promise((resolve) => {
    const child = execFile('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      const code = error ? (error as { code?: number | string }).code ?? -1 : 0;
      resolve({ code, stdout: String(stdout) });
    });
    if (input !== undefined) {
      child.stdin?.on('error', () => undefined);
      child.stdin?.end(input);
    }
  });
}

// The root of the repository that holds `dir`, or undefined when there is none.
export async function repositoryRoot(dir: string): Promise<string | undefined> {
  const { code, stdout } = await run(['rev-parse', '--show-toplevel'], dir);
  if (code !== 0) return;
  const root = stdout.trim();
  return root ? root : undefined;
}

// Ask git directly which of the given absolute paths it ignores. The paths must lie inside
// the repository at `repoRoot` and must not pass through a symbolic link, or git refuses the
// whole request. Anything git cannot answer (exit code other than 0 or 1) counts as not
// ignored.
export async function cliIgnoredPaths(
  repoRoot: string,
  absolutePaths: string[]
): Promise<Set<string>> {
  if (absolutePaths.length === 0) return new Set();
  const { code, stdout } = await run(
    ['check-ignore', '-z', '--stdin'],
    repoRoot,
    absolutePaths.join('\0') + '\0'
  );
  // Exit 0: some paths are ignored. Exit 1: none are.
  if (code !== 0 && code !== 1) return new Set();
  return new Set(stdout.split('\0').filter(Boolean));
}

type GitRepositoryLike = {
  rootUri: { fsPath: string };
  checkIgnore(paths: string[]): Promise<Set<string>>;
};

export type GitApiLike = {
  repositories: ReadonlyArray<GitRepositoryLike>;
};

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// Every repository root that contains `path`, innermost first: found by asking git from the
// file's directory, then again from just above each root found, until there is none.
async function enclosingRepositoryRoots(
  path: string,
  cache: Map<string, string | undefined>
): Promise<string[]> {
  const roots: string[] = [];
  let dir: string | undefined = dirname(path);
  while (dir) {
    if (!cache.has(dir)) cache.set(dir, await repositoryRoot(dir));
    const root = cache.get(dir);
    if (!root) break;
    roots.push(root);
    const parent = dirname(root);
    dir = parent === root ? undefined : parent;
  }
  return roots;
}

/**
 * Which of the given absolute paths does git ignore?
 *
 * The answer follows what the VS Code Explorer grays out. The Explorer's decorations come
 * from the built-in Git extension, which asks each repository it has open; a directory that
 * an outer repository ignores is grayed even when it is a repository of its own (as a git
 * worktree or a nested clone would be). So a path counts as ignored when any repository
 * enclosing it says so.
 *
 * For each repository, the Git extension answers when it has that repository open, so no git
 * process is spawned. Otherwise (a nested repository nobody has opened a file in, or the Git
 * extension being disabled) the git command line is asked directly. A path outside any
 * repository is never ignored.
 */
export async function gitIgnoredPaths(
  absolutePaths: string[],
  api: GitApiLike | undefined = getGitApi()
): Promise<Set<string>> {
  const openRepositories = new Map<string, GitRepositoryLike>();
  for (const repository of api?.repositories || [])
    openRepositories.set(repository.rootUri.fsPath, repository);

  const rootCache = new Map<string, string | undefined>();
  const byRoot = new Map<string, string[]>();
  for (const path of absolutePaths) {
    const roots = new Set<string>(await enclosingRepositoryRoots(path, rootCache));
    for (const root of openRepositories.keys()) if (isInside(root, path)) roots.add(root);
    for (const root of roots) byRoot.set(root, [...(byRoot.get(root) || []), path]);
  }

  const ignored = new Set<string>();
  for (const [root, paths] of byRoot) {
    let answer: Set<string> | undefined;
    const repository = openRepositories.get(root);
    if (repository) {
      try {
        answer = await repository.checkIgnore(paths);
      } catch {
        answer = undefined;
      }
    }
    if (!answer) answer = await cliIgnoredPaths(root, paths);
    answer.forEach((path) => ignored.add(path));
  }
  return ignored;
}

export const DEFAULT_DEPS: ConfigFileFilterDeps = {
  realpath: fsRealpath,
  gitIgnored: (paths) => gitIgnoredPaths(paths),
};

/**
 * Reduce a list of candidate appmap.yml paths found under a workspace folder to the ones
 * that should drive AppMap services:
 *
 * 1. Drop anything under node_modules, a virtualenv, or a VCS directory.
 * 2. Resolve symbolic links and keep one path per real file (the shortest).
 * 3. Drop files that git ignores, judged by every repository enclosing them, like the Explorer does.
 *
 * The returned paths keep the spelling they were given in; symlinks are resolved only to
 * compare files and to ask git, which refuses paths that pass through a link.
 */
export async function filterConfigFiles(
  folder: string,
  candidates: string[],
  deps: ConfigFileFilterDeps = DEFAULT_DEPS
): Promise<string[]> {
  const inProject = candidates.filter((path) => !isInExcludedDirectory(folder, path));

  const realOf = new Map<string, string>();
  const chosenFor = new Map<string, string>();
  const byPreference = [...inProject].sort(
    (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)
  );
  for (const path of byPreference) {
    let real: string;
    try {
      real = await deps.realpath(path);
    } catch {
      continue; // The file is gone.
    }
    if (chosenFor.has(real)) continue;
    chosenFor.set(real, path);
    realOf.set(path, real);
  }
  const unique = inProject.filter((path) => realOf.has(path));

  const ignored = await deps.gitIgnored(unique.map((path) => realOf.get(path) as string));
  return unique.filter((path) => !ignored.has(realOf.get(path) as string));
}
