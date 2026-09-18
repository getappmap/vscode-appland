import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

import { displayPath } from '../../assets/helpers';
import * as log from '../../assets/log';
import SkillsCache from './skillsCache';

// Written into a skill directory that we had to copy rather than symlink, so
// we can still tell it apart from a skill the user wrote by hand.
const MARKER_FILE = '.appmap-skill';

// Left in each skills directory we install into, so that someone who comes
// across these entries in an agent's configuration directory can find out
// where they came from without having to guess.
//
// A dotfile with no extension, rather than a README: the directory is not
// ours, only some of its entries are, and an agent looking for skills should
// have no reason to read it. It is rewritten on every sync and deleted once
// we have nothing installed there.
const NOTE_FILE = '.appmap-skills';

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

    // Assemble the copy beside its destination and swap it in whole. A copy
    // that fails part-way would otherwise leave a directory holding some of a
    // skill and no marker file, which `inspect` reads as a skill the user
    // wrote by hand -- so we would never touch it again, and the agent would
    // go on reading the truncated copy. Leaving nothing behind is recoverable:
    // the entry reads as absent and the next update installs it.
    const staging = `${this.path}.staging`;
    await rm(staging, { recursive: true, force: true });
    try {
      await cp(source, staging, { recursive: true });
      await writeFile(join(staging, MARKER_FILE), (await this.cache.version()) ?? '');
      await rename(staging, this.path);
    } finally {
      await rm(staging, { recursive: true, force: true });
    }
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
  dir = resolve(dir);
  const removed: string[] = [];
  const remaining: string[] = [];
  for (const name of await installedSkills(cache, dir)) {
    if (keep.includes(name)) {
      remaining.push(name);
      continue;
    }
    await new SkillLink(join(dir, name), cache).remove();
    removed.push(name);
  }

  await writeNote(dir, cache.dir, remaining);
  return removed;
}

// Record which entries of `dir` are ours, or take the note away once none of
// them are. Written last, so it describes the directory as it now stands.
async function writeNote(dir: string, cacheDir: string, skills: string[]): Promise<void> {
  const path = join(dir, NOTE_FILE);
  if (skills.length === 0) return await rm(path, { force: true });

  await writeFile(
    path,
    [
      'These entries in this directory are installed and kept up to date by the',
      'AppMap extension for VS Code:',
      '',
      ...skills.map((skill) => `    ${skill}`),
      '',
      `They come from ${displayPath(cacheDir)}, an unpacked copy of the latest`,
      'AppMap skills release. Nothing else in this directory is touched by AppMap.',
      '',
      'To remove them and stop them from being installed again, set',
      '"appMap.skills.install": false in your VS Code settings. Deleting them by',
      'hand works too, but they will come back the next time the extension',
      'updates its skills.',
      '',
      'This file is written by AppMap and rewritten on every update.',
      '',
    ].join('\n')
  );
}
