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
import { basename, dirname, join, resolve } from 'node:path';

import * as log from '../../assets/log';
import SkillsCache from './skillsCache';

// Written into a skill directory that we had to copy rather than symlink, so
// we can still tell it apart from a skill the user wrote by hand.
const MARKER_FILE = '.appmap-skill';

export type SkillLinkState =
  | { kind: 'absent' } // nothing at the path
  | { kind: 'foreign' } // something we didn't put there; never touched
  | { kind: 'link' } // symlink into the cache; always current
  | { kind: 'copy'; version: string }; // copied from the cache and stamped with a version

// One entry in an agent's skills directory (for example
// ~/.claude/skills/appmap-record). This is the only code that knows how an
// installed skill is represented on disk: a symlink into the cache, or on
// platforms that disallow symlinks, a copy carrying a marker file.
export default class SkillLink {
  constructor(readonly path: string, private readonly cache: SkillsCache) {}

  get name(): string {
    return basename(this.path);
  }

  async inspect(): Promise<SkillLinkState> {
    let stats;
    try {
      stats = await lstat(this.path);
    } catch {
      return { kind: 'absent' };
    }

    if (stats.isSymbolicLink()) {
      const target = resolve(dirname(this.path), await readlink(this.path));
      return this.cache.contains(target) ? { kind: 'link' } : { kind: 'foreign' };
    }

    if (stats.isDirectory()) {
      try {
        const version = (await readFile(join(this.path, MARKER_FILE), 'utf8')).trim();
        return { kind: 'copy', version };
      } catch {
        return { kind: 'foreign' };
      }
    }

    return { kind: 'foreign' };
  }

  // Point this entry at the cached skill of the same name. Prefers a symlink;
  // falls back to a copy (Windows without Developer Mode).
  async install(): Promise<void> {
    const source = this.cache.pathTo(this.name);
    await rm(this.path, { recursive: true, force: true });

    try {
      await symlink(source, this.path, 'dir');
      return;
    } catch (e) {
      log.info(`Could not symlink ${this.path}, copying instead: ${e}`);
    }

    await cp(source, this.path, { recursive: true });
    await writeFile(join(this.path, MARKER_FILE), (await this.cache.version()) ?? '');
  }

  async remove(): Promise<void> {
    await rm(this.path, { recursive: true, force: true });
  }
}

// Bring the skills directory `dir` in line with the cache: link every cached
// skill that isn't already current, and remove links to skills that have
// dropped out of the release. Entries we didn't create are left alone.
export async function syncSkillLinks(cache: SkillsCache, dir: string): Promise<void> {
  const skills = await cache.skills();
  const version = await cache.version();
  await mkdir(dir, { recursive: true });

  for (const name of skills) {
    const link = new SkillLink(join(dir, name), cache);
    const state = await link.inspect();
    if (state.kind === 'foreign') {
      log.info(`Skipping skill ${name}: ${link.path} was not installed by AppMap`);
      continue;
    }
    if (state.kind === 'link' || (state.kind === 'copy' && state.version === version)) continue;

    log.info(`Installing skill ${name} to ${link.path}`);
    await link.install();
  }

  const removed = await removeSkillLinks(cache, dir, skills);
  if (removed.length)
    log.info(
      `Removed skills no longer present in the AppMap release from ${dir}: ${removed.join(', ')}`
    );
}

// Names of the entries in `dir` that we installed.
export async function installedSkills(cache: SkillsCache, dir: string): Promise<string[]> {
  dir = resolve(dir);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return [];
  }

  const installed: string[] = [];
  for (const name of names) {
    const { kind } = await new SkillLink(join(dir, name), cache).inspect();
    if (kind === 'link' || kind === 'copy') installed.push(name);
  }
  return installed;
}

// Remove the skills we installed into `dir`, except those named in `keep`, and
// return the names removed. Entries we didn't create are left alone.
export async function removeSkillLinks(
  cache: SkillsCache,
  dir: string,
  keep: string[] = []
): Promise<string[]> {
  const removed: string[] = [];
  for (const name of await installedSkills(cache, dir)) {
    if (keep.includes(name)) continue;
    await new SkillLink(join(resolve(dir), name), cache).remove();
    removed.push(name);
  }
  return removed;
}
