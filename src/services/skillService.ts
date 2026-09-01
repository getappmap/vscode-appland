import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { join, resolve as resolvePath } from 'node:path';
import { Uri } from 'vscode';
import * as vscode from 'vscode';
import * as tar from 'tar';

import * as log from '../assets/log';
import ExtensionSettings from '../configuration/extensionSettings';
import { GithubReleaseCache, GitHubReleaseResolver } from '../assets/resolvers';
import { AppMapSkillsDir, ClaudeSkillsDir, cacheDir, download } from '../assets/helpers';
import runUpdates from '../assets/runUpdates';

// Written into each installed skill directory so that we can tell an
// extension-managed install apart from a skill the user wrote by hand. This
// matters on Windows, where `installSkill` copies instead of symlinking and
// there's no link target to inspect.
const MARKER_FILE = '.appmap-skill';

// Every directory holding a SKILL.md is a skill; anything else in the release
// (README.md, LICENSE, .github, ...) is repository scaffolding we don't install.
async function listSkills(versionDir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(versionDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await lstat(join(versionDir, entry.name, 'SKILL.md'));
      names.push(entry.name);
    } catch {
      // no SKILL.md; not a skill directory
    }
  }
  return names.sort();
}

// Whether we may overwrite `path`. We own it if it doesn't exist, if it's a
// symlink into our own skills cache, or if it's a directory carrying our
// marker file. Anything else is the user's and is left strictly alone.
async function isManaged(path: string): Promise<boolean> {
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    return true; // nothing there, so it's ours to create
  }

  if (stats.isSymbolicLink()) {
    try {
      const target = resolvePath(await readlink(path));
      return target === AppMapSkillsDir() || target.startsWith(AppMapSkillsDir() + '/');
    } catch {
      return true; // broken link that we can't resolve; safe to replace
    }
  }

  if (stats.isDirectory()) {
    try {
      await lstat(join(path, MARKER_FILE));
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

async function currentInstalledVersion(linkPath: string): Promise<string | undefined> {
  try {
    const stats = await lstat(linkPath);
    if (stats.isSymbolicLink()) {
      const target = resolvePath(await readlink(linkPath));
      const relative = target.slice(AppMapSkillsDir().length + 1);
      return relative.split('/')[0] || undefined;
    }
    return (await readFile(join(linkPath, MARKER_FILE), 'utf8')).trim() || undefined;
  } catch {
    return undefined;
  }
}

// Point `linkPath` at `skillDir`. Prefers a directory symlink; falls back to a
// recursive copy on platforms that disallow symlink creation (Windows without
// Developer Mode), stamping the copy with a marker so we can recognize and
// update it later.
async function installSkill(skillDir: string, linkPath: string, version: string): Promise<void> {
  await rm(linkPath, { recursive: true, force: true });
  await mkdir(ClaudeSkillsDir(), { recursive: true });

  try {
    await symlink(skillDir, linkPath, 'dir');
    return;
  } catch (e) {
    log.info(`Could not symlink ${linkPath}, copying instead: ${e}`);
  }

  await cp(skillDir, linkPath, { recursive: true });
  await writeFile(join(linkPath, MARKER_FILE), version);
}

// Remove links for skills that were dropped from the release, so a renamed or
// retired skill doesn't linger forever. Only touches entries we manage.
async function pruneRemovedSkills(current: string[]): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(ClaudeSkillsDir());
  } catch {
    return;
  }

  for (const entry of entries) {
    if (current.includes(entry)) continue;
    const path = join(ClaudeSkillsDir(), entry);
    if (!(await isManaged(path))) continue;
    // Don't delete a directory just because it exists; require positive
    // evidence that we installed it.
    const installed = await currentInstalledVersion(path);
    if (!installed) continue;
    log.info(`Removing skill ${entry}, no longer present in the AppMap skills release`);
    await rm(path, { recursive: true, force: true });
  }
}

// Delete cached skill releases other than the active one. The cache exists to
// avoid re-downloading the current version, not to keep history.
async function pruneOldVersions(keep: string): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(AppMapSkillsDir());
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === keep) continue;
    await rm(join(AppMapSkillsDir(), entry), { recursive: true, force: true }).catch((e) =>
      log.warning(`Failed to remove stale skills version ${entry}: ${e}`)
    );
  }
}

async function extractRelease(version: string): Promise<string> {
  const versionDir = join(AppMapSkillsDir(), version);
  if ((await listSkills(versionDir)).length > 0) return versionDir;

  const archivePath = join(cacheDir(), `appmap-skills-${version}.tar.gz`);
  const url = `https://github.com/${ExtensionSettings.skillsRepository}/archive/refs/tags/v${version}.tar.gz`;
  await download(Uri.parse(url), archivePath);

  // Extract into a scratch directory first so a failed or partial extraction
  // never leaves a half-populated version directory that looks complete.
  const stagingDir = `${versionDir}.staging`;
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(stagingDir, { recursive: true });
  try {
    // strip: 1 drops the `skills-<version>/` prefix GitHub adds to source archives.
    await tar.extract({ file: archivePath, cwd: stagingDir, strip: 1 });
    await rm(versionDir, { recursive: true, force: true });
    await cp(stagingDir, versionDir, { recursive: true });
  } finally {
    await rm(stagingDir, { recursive: true, force: true });
    await rm(archivePath, { force: true });
  }

  return versionDir;
}

export default class SkillService {
  static register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (
          e.affectsConfiguration('appMap.autoUpdateSkills') ||
          e.affectsConfiguration('appMap.skills.repository')
        ) {
          GithubReleaseCache.clear();
          void this.ensureInstalled();
        }
      })
    );
  }

  static async ensureInstalled(throwOnError = false): Promise<void> {
    if (!ExtensionSettings.autoUpdateSkills) {
      log.info('Automatic AppMap skills updates are disabled, skipping.');
      return;
    }

    return runUpdates([() => this.installLatest()], throwOnError);
  }

  private static async installLatest(): Promise<void> {
    const version = await new GitHubReleaseResolver(
      ExtensionSettings.skillsRepository
    ).getLatestVersion();
    if (!version) throw new Error('Error resolving the latest AppMap skills version');

    const versionDir = await extractRelease(version);
    const skills = await listSkills(versionDir);
    if (skills.length === 0) throw new Error(`AppMap skills release ${version} contains no skills`);

    for (const skill of skills) {
      const linkPath = join(ClaudeSkillsDir(), skill);
      if (!(await isManaged(linkPath))) {
        log.info(`Skipping skill ${skill}: ${linkPath} was not installed by AppMap`);
        continue;
      }

      if ((await currentInstalledVersion(linkPath)) === version) continue;

      log.info(`Installing skill ${skill} version ${version} to ${linkPath}`);
      await installSkill(join(versionDir, skill), linkPath, version);
    }

    await pruneRemovedSkills(skills);
    await pruneOldVersions(version);
  }
}
