import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { applyEdits, modify, parse, ParseError } from 'jsonc-parser';

import * as log from '../../assets/log';

// The entries we want present under "servers" in .vscode/mcp.json. VS Code
// expands ${userHome} itself, so the file stays portable between machines.
const APPMAP_COMMAND = '${userHome}/.appmap/bin/appmap';

export const APPMAP_MCP_SERVERS: Record<string, unknown> = {
  appmap: {
    type: 'stdio',
    command: APPMAP_COMMAND,
    args: ['query', 'mcp'],
  },
  'appmap-gold-traces': {
    type: 'stdio',
    command: APPMAP_COMMAND,
    args: [
      'query',
      'mcp',
      '--appmap-dir',
      'gold_traces/baseline/appmaps',
      '--query-db',
      'tmp/gold_traces_query.db',
    ],
  },
};

// .vscode/mcp.json is where VS Code reads a workspace's MCP servers from. It
// is checked into the user's repository and shared with other tools, so we
// only ever edit it in place, keeping other servers, comments and formatting,
// and only after the user has agreed (see SkillService).

export function mcpJsonPath(folder: string): string {
  return join(folder, '.vscode', 'mcp.json');
}

async function readMcpJson(folder: string): Promise<string> {
  try {
    return await readFile(mcpJsonPath(folder), 'utf8');
  } catch {
    return '';
  }
}

function parseMcpJson(text: string): Record<string, unknown> {
  const errors: ParseError[] = [];
  const config: unknown = parse(text, errors, { allowTrailingComma: true });
  if (errors.length > 0 || typeof config !== 'object' || config === null || Array.isArray(config))
    throw new Error('mcp.json could not be parsed');
  return config as Record<string, unknown>;
}

function listedServers(config: Record<string, unknown>): string[] {
  const { servers } = config;
  return servers && typeof servers === 'object' ? Object.keys(servers) : [];
}

// Names of the AppMap servers the workspace does not list yet. An existing
// entry counts however it is configured. A file that cannot be parsed reports
// nothing missing: we cannot tell what it holds, and we will not rewrite it.
export async function missingAppMapMcpServers(folder: string): Promise<string[]> {
  const text = await readMcpJson(folder);
  let listed: string[] = [];
  if (text.trim()) {
    try {
      listed = listedServers(parseMcpJson(text));
    } catch {
      log.warning(`Leaving ${mcpJsonPath(folder)} alone: it could not be parsed`);
      return [];
    }
  }
  return Object.keys(APPMAP_MCP_SERVERS).filter((name) => !listed.includes(name));
}

// Add the named AppMap servers to the workspace's mcp.json, creating the file
// if needed. Throws rather than touching a file it cannot parse.
export async function addAppMapMcpServers(folder: string, names: string[]): Promise<void> {
  const path = mcpJsonPath(folder);
  let text = await readMcpJson(folder);
  if (!text.trim()) text = '{}\n';
  parseMcpJson(text);

  for (const name of names) {
    const edits = modify(text, ['servers', name], APPMAP_MCP_SERVERS[name], {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    text = applyEdits(text, edits);
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text);
}
