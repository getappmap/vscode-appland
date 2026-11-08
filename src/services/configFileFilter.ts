import { ChildProcess, execFile } from 'child_process';
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
  // Given absolute paths in the workspace folder, return the subset that git ignores.
  gitIgnored: (absolutePaths: string[], folder: string) => Promise<Set<string>>;
};

export function isInExcludedDirectory(folder: string, filePath: string): boolean {
  const rel = relative(folder, filePath);
  return rel.split(/[\\/]/).some((segment) => EXCLUDED_DIRECTORIES.includes(segment));
}

// Config changes are handled one at a time, so a git command that hangs (on an unresponsive
// network mount, say) would hold up every later one. Past this, git is given up on, and its
// silence counts as "not a repository" or "not ignored".
export const GIT_OPTIONS = { timeout: 10_000 };

// Variables that point git at a particular repository whatever directory it runs in. The
// extension host can inherit them (VS Code launched from a git hook, or a dotfiles setup
// that exports them); git would then answer every question about that repository.
const REPOSITORY_OVERRIDES = ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'];

function gitEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of REPOSITORY_OVERRIDES) delete env[name];
  return env;
}

function run(
  args: string[],
  cwd: string,
  input?: string
): Promise<{ code: number | string; stdout: string }> {
  return new Promise((resolve) => {
    const options = { cwd, env: gitEnvironment(), maxBuffer: 16 * 1024 * 1024 };
    let child: ChildProcess;
    try {
      // The git the Git extension found (honoring the git.path setting, and install locations
      // that are not on the PATH), so that the answers match the Explorer's.
      const git = getGitApi()?.git.path ?? 'git';
      child = execFile(git, args, options, (error, stdout) => {
        clearTimeout(timer);
        const code = error ? (error as { code?: number | string }).code ?? -1 : 0;
        resolve({ code, stdout: String(stdout) });
      });
    } catch (e) {
      // Some spawn failures throw rather than reach the callback -- on Windows, a git.path
      // naming a .cmd or .bat file, which Node will not run without a shell. That is git
      // being unavailable, like any other.
      resolve({ code: (e as { code?: string }).code ?? 'ESPAWN', stdout: '' });
      return;
    }
    // Not execFile's own timeout: that signals git, then still waits for it to exit, which a
    // git stuck in uninterruptible I/O (on a hung network mount, say) can put off forever.
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ code: 'ETIMEDOUT', stdout: '' });
    }, GIT_OPTIONS.timeout);
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
  if (code === 0 || code === 1) return new Set(stdout.split('\0').filter(Boolean));
  if (absolutePaths.length === 1) return new Set();
  // Git refuses the whole request over a single path it will not judge, such as one inside a
  // submodule. Ask about each path on its own, so the others still get an answer.
  const ignored = new Set<string>();
  for (const path of absolutePaths)
    if ((await cliIgnoredPaths(repoRoot, [path])).size) ignored.add(path);
  return ignored;
}

function isInside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// The repository roots whose say counts for `path`, innermost first: found by asking git from
// the file's directory, then again from just above each root found, up to and including the
// first root that holds the workspace folder itself -- the folder's own repository.
async function enclosingRepositoryRoots(
  path: string,
  folder: string,
  cache: Map<string, string | undefined>
): Promise<string[]> {
  const roots: string[] = [];
  let dir: string | undefined = dirname(path);
  while (dir) {
    if (!cache.has(dir)) cache.set(dir, await repositoryRoot(dir));
    const root = cache.get(dir);
    // A root that does not contain the directory asked about is not an answer to the question,
    // and following it could go round in circles.
    if (!root || !isInside(root, dir)) break;
    roots.push(root);
    if (isInside(root, folder)) break;
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
 * worktree or a nested clone would be). So a path counts as ignored when a repository between
 * it and the workspace folder says so, or the repository that holds the workspace folder does.
 * Each repository is asked with git check-ignore, as the Git extension does.
 *
 * Repositories further out are not asked: the Git extension does not open them without the
 * user's say-so, so the Explorer does not gray anything for them. Nor is the folder's own
 * repository asked when it ignores the whole folder -- a worktree or a clone that a project
 * keeps in an ignored directory, or a home directory under version control that ignores
 * everything by default, is not where the folder's own ignore rules live.
 *
 * A path outside any repository is never ignored.
 */
export async function gitIgnoredPaths(
  absolutePaths: string[],
  folder: string
): Promise<Set<string>> {
  const rootCache = new Map<string, string | undefined>();
  const byRoot = new Map<string, string[]>();
  for (const path of absolutePaths) {
    for (const root of await enclosingRepositoryRoots(path, folder, rootCache))
      byRoot.set(root, [...(byRoot.get(root) || []), path]);
  }

  const ignored = new Set<string>();
  for (const [root, paths] of byRoot) {
    if (
      relative(root, folder) !== '' &&
      isInside(root, folder) &&
      (await cliIgnoredPaths(root, [folder])).size
    )
      continue;
    (await cliIgnoredPaths(root, paths)).forEach((path) => ignored.add(path));
  }
  return ignored;
}

export const DEFAULT_DEPS: ConfigFileFilterDeps = {
  realpath: fsRealpath,
  gitIgnored: gitIgnoredPaths,
};

/**
 * Reduce a list of candidate appmap.yml paths found under a workspace folder to the ones
 * that should drive AppMap services:
 *
 * 1. Drop anything under node_modules, a virtualenv, or a VCS directory.
 * 2. Resolve symbolic links and keep one path per real file (the shortest).
 * 3. Drop files that git ignores, judged like the Explorer does (see gitIgnoredPaths).
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
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue; // The file is gone.
      // Anything else (a file locked by anti-virus, a drive realpath cannot resolve) is no
      // reason to drop the file: take it as found.
      real = path;
    }
    if (chosenFor.has(real)) continue;
    chosenFor.set(real, path);
    realOf.set(path, real);
  }
  const unique = inProject.filter((path) => realOf.has(path));

  let realFolder = folder;
  try {
    realFolder = await deps.realpath(folder);
  } catch {
    // Compare as given, then.
  }
  const ignored = await deps.gitIgnored(
    unique.map((path) => realOf.get(path) as string),
    realFolder
  );
  return unique.filter((path) => !ignored.has(realOf.get(path) as string));
}
