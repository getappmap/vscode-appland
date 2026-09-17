import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { applyEdits, modify, parse, ParseError } from 'jsonc-parser';

// The entry we want present under "servers" in .vscode/mcp.json.
export const APPMAP_MCP_SERVER = {
  type: 'stdio',
  command: 'appmap',
  args: ['query', 'mcp'],
};

// .vscode/mcp.json is where VS Code reads a workspace's MCP servers from. It
// is checked into the user's repository and shared with other tools, so we
// only ever edit it in place, keeping other servers, comments and formatting,
// and only after the user has agreed (see SkillService).

function mcpJsonPath(folder: string): string {
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

// Whether the workspace already lists an "appmap" server, however configured.
export async function hasAppMapMcpServer(folder: string): Promise<boolean> {
  const text = await readMcpJson(folder);
  if (!text.trim()) return false;

  let config: Record<string, unknown>;
  try {
    config = parseMcpJson(text);
  } catch {
    return false;
  }
  const { servers } = config;
  return !!servers && typeof servers === 'object' && 'appmap' in servers;
}

// Add the AppMap server to the workspace's mcp.json, creating the file if
// needed. Throws rather than touching a file it cannot parse.
export async function addAppMapMcpServer(folder: string): Promise<void> {
  const path = mcpJsonPath(folder);
  let text = await readMcpJson(folder);
  if (!text.trim()) text = '{}\n';
  parseMcpJson(text);

  const edits = modify(text, ['servers', 'appmap'], APPMAP_MCP_SERVER, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, applyEdits(text, edits));
}
