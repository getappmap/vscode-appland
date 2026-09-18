import '../../mock/vscode';
import { tmpdir } from 'os';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';

import {
  APPMAP_MCP_SERVERS,
  addAppMapMcpServers,
  missingAppMapMcpServers,
} from '../../../../src/services/skills/mcpConfig';

chai.use(chaiFs);

const ALL = ['appmap', 'appmap-gold-traces'];

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

  describe('missingAppMapMcpServers', () => {
    it('reports both when there is no file', async () => {
      expect(await missingAppMapMcpServers(folder)).to.deep.equal(ALL);
    });

    it('reports both when the file lists other servers only', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": { "other": {} } }');
      expect(await missingAppMapMcpServers(folder)).to.deep.equal(ALL);
    });

    it('reports only the one that is absent, however the other is configured', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": { "appmap": { "command": "/my/appmap" } } }');
      expect(await missingAppMapMcpServers(folder)).to.deep.equal(['appmap-gold-traces']);
    });

    it('reports nothing for a file it cannot parse, so it is left alone', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": \n');
      expect(await missingAppMapMcpServers(folder)).to.deep.equal([]);
    });
  });

  describe('addAppMapMcpServers', () => {
    it('creates .vscode/mcp.json when there is none', async () => {
      await addAppMapMcpServers(folder, ALL);

      expect(mcpJson).to.be.a.file();
      expect(JSON.parse(await readFile(mcpJson, 'utf8'))).to.deep.equal({
        servers: APPMAP_MCP_SERVERS,
      });
    });

    it('uses ${userHome} so the file is portable', async () => {
      await addAppMapMcpServers(folder, ['appmap']);
      expect(await readFile(mcpJson, 'utf8')).to.include('"${userHome}/.appmap/bin/appmap"');
    });

    it('adds the servers alongside existing ones, keeping comments and formatting', async () => {
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

      await addAppMapMcpServers(folder, ALL);

      const updated = await readFile(mcpJson, 'utf8');
      expect(updated).to.include('// my servers');
      expect(updated).to.include('"inputs": []');
      expect(updated).to.include('"other": {');
      expect(updated).to.include('"command": "other"');
      expect(updated).to.include('"appmap": {');
      expect(updated).to.include('"appmap-gold-traces": {');
      expect(updated).to.include('"--query-db"');
    });

    it('adds only the named servers', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": { "appmap": { "command": "/my/appmap" } } }\n');

      await addAppMapMcpServers(folder, ['appmap-gold-traces']);

      const config = JSON.parse(await readFile(mcpJson, 'utf8'));
      expect(config.servers.appmap).to.deep.equal({ command: '/my/appmap' });
      expect(config.servers['appmap-gold-traces']).to.deep.equal(
        APPMAP_MCP_SERVERS['appmap-gold-traces']
      );
    });

    it('refuses to touch a file it cannot parse', async () => {
      await mkdir(join(folder, '.vscode'));
      await writeFile(mcpJson, '{ "servers": \n');

      let err: Error | undefined;
      try {
        await addAppMapMcpServers(folder, ALL);
      } catch (e) {
        err = e as Error;
      }

      expect(err?.message).to.match(/could not be parsed/);
      expect(mcpJson).to.be.a.file().with.content('{ "servers": \n');
    });
  });
});
