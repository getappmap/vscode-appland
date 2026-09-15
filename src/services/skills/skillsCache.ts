import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { Uri } from 'vscode';
import * as tar from 'tar';

import { cacheDir, download } from '../../assets/helpers';

// Name of the file inside the cache directory that records which release is
// unpacked there. Lets us skip the download when nothing has changed.
const VERSION_FILE = '.version';

// The local copy of the AppMap skills release, unpacked at a stable path:
//
//   <dir>/<skill>/SKILL.md
//   <dir>/.version
//
// Agents never read from here directly. Skills are linked from here into each
// agent's own skills directory (see skillLink.ts), and the path is stable so
// that people who prefer to manage those links by hand can do so.
export default class SkillsCache {
  constructor(readonly dir: string) {}

  // Version currently unpacked in the cache, or undefined if the cache is empty.
  async version(): Promise<string | undefined> {
    try {
      return (await readFile(join(this.dir, VERSION_FILE), 'utf8')).trim() || undefined;
    } catch {
      return undefined;
    }
  }

  // Names of the skills in the cache. Every directory holding a SKILL.md is a
  // skill; anything else in the release (README.md, LICENSE, .github, ...) is
  // repository scaffolding.
  async skills(): Promise<string[]> {
    return listSkills(this.dir);
  }

  pathTo(skill: string): string {
    return join(this.dir, skill);
  }

  // Whether `path` points inside the cache.
  contains(path: string): boolean {
    const rel = relative(this.dir, path);
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
  }

  // Replace the cache contents with the release at `archiveUrl`, unless that
  // version is already unpacked. The archive is a GitHub source tarball, so
  // it has a single top-level `<repo>-<version>/` directory which is stripped.
  async update(version: string, archiveUrl: Uri): Promise<void> {
    if ((await this.version()) === version) return;

    const archivePath = join(cacheDir(), `appmap-skills-${version}.tar.gz`);
    await download(archiveUrl, archivePath);

    // Unpack next to the cache, then swap the new directory into place, so a
    // failed or partial extraction never leaves a half-populated cache.
    const staging = `${this.dir}.staging`;
    const previous = `${this.dir}.previous`;
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    try {
      await tar.extract({ file: archivePath, cwd: staging, strip: 1 });
      if ((await listSkills(staging)).length === 0)
        throw new Error(`AppMap skills release ${version} contains no skills`);
      await writeFile(join(staging, VERSION_FILE), version);

      await rm(previous, { recursive: true, force: true });
      if (await exists(this.dir)) await rename(this.dir, previous);
      await rename(staging, this.dir);
      await rm(previous, { recursive: true, force: true });
    } finally {
      await rm(staging, { recursive: true, force: true });
      await rm(archivePath, { force: true });
    }
  }
}

async function listSkills(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const names: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && (await exists(join(dir, entry.name, 'SKILL.md'))))
      names.push(entry.name);
  }
  return names.sort();
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
