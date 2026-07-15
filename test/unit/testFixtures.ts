// Pure (vscode-free) test helpers for unit tests, replacing the equivalents in
// test/integration/util.ts — importing that module would pull in the full vscode
// runtime and AppMapService graph, which unit tests deliberately avoid.
import { join } from 'path';
import { promises as fs } from 'fs';
import * as tmp from 'tmp';
import { promisify } from 'util';

import type { CodeObjectEntry } from '../../src/lib/CodeObjectEntry';

// __dirname is test/unit at runtime (ts-node compiles in place), so ../fixtures
// resolves to test/fixtures.
export const FixtureDir = join(__dirname, '../fixtures');
export const ProjectA = join(FixtureDir, 'workspaces/project-a');
export const ProjectJava = join(FixtureDir, 'workspaces/project-java');

export async function withTmpDir(fn: (tmpDir: string) => void | Promise<void>): Promise<void> {
  const tmpDir = await promisify(tmp.dir)();
  try {
    await fn(tmpDir);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

export function printCodeObject(
  buffer: string[],
  depth: number,
  codeObject: CodeObjectEntry
): string[] {
  buffer.push(['  '.repeat(depth), codeObject.fqid].join(''));
  codeObject.children.forEach(printCodeObject.bind(null, buffer, depth + 1));
  return buffer;
}
