import '../../mock/vscode';
import { tmpdir } from 'os';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';

import {
  APPMAP_MCP_SERVER,
  addAppMapMcpServer,
  hasAppMapMcpServer,
} from '../../../../src/services/skills/mcpConfig';

chai.use(chaiFs);

describe('mcpConfig', () => {
  let folder: string;
  let mcpJson: string;

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'mcp-config-test-'));
    mcpJson = join(folder, '.vscode', 'mcp.json');
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  describe('hasAppMapMcpServer', () => {
    it('is false when there is no file', async () => {
      expect(await hasAppMapMcpServer(folder)).to.be.false;
    });

    it('is false when the file lists other servers only', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": { "other": {} } }');
      expect(await hasAppMapMcpServer(folder)).to.be.false;
    });

    it('is true when an appmap server is listed, however configured', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": { "appmap": { "command": "/my/appmap" } } }');
      expect(await hasAppMapMcpServer(folder)).to.be.true;
    });
  });

  describe('addAppMapMcpServer', () => {
    it('creates .vscode/mcp.json when there is none', async () => {
      await addAppMapMcpServer(folder);

      expect(mcpJson).to.be.a.file();
      expect(JSON.parse(await readFile(mcpJson, 'utf8'))).to.deep.equal({
        servers: { appmap: APPMAP_MCP_SERVER },
      });
    });

    it('adds the server alongside existing ones, keeping comments and formatting', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(
        mcpJson,
        `{
  // my servers
  "servers": {
    "other": { "type": "stdio", "command": "other" },
  },
  "inputs": []
}
`
      );

      await addAppMapMcpServer(folder);

      const updated = await readFile(mcpJson, 'utf8');
      expect(updated).to.include('// my servers');
      expect(updated).to.include('"inputs": []');
      expect(updated).to.include('"other": {');
      expect(updated).to.include('"command": "other"');
      expect(updated).to.include('"appmap": {');
      expect(updated).to.include('"command": "appmap"');
      expect(updated).to.include('"query"');
    });

    it('adds a servers section to a file that has none', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "inputs": [] }\n');

      await addAppMapMcpServer(folder);

      expect(JSON.parse(await readFile(mcpJson, 'utf8'))).to.deep.equal({
        inputs: [],
        servers: { appmap: APPMAP_MCP_SERVER },
      });
    });

    it('refuses to touch a file it cannot parse', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": \n');

      let err: Error | undefined;
      try {
        await addAppMapMcpServer(folder);
      } catch (e) {
        err = e as Error;
      }

      expect(err?.message).to.match(/could not be parsed/);
      expect(mcpJson).to.be.a.file().with.content('{ "servers": \n');
    });
  });
});
