import assert = require('assert');
import { workspace } from 'vscode';
import { resolve } from 'path';
import { promises as fsPromises } from 'fs';
import { suite, test, describe, before, after } from 'mocha';

import { getVersionControlProperties } from '../../src/telemetry/properties/version_control';

suite('Properties: Version Control', () => {
  const rootDir = workspace.workspaceFolders![0];
  const rootPath = rootDir.uri.fsPath;
  const trackedFile = resolve(rootPath, 'Tracked.txt');
  const untrackedFile = resolve(rootPath, 'Untracked.txt');
  const ignoredFile = resolve(rootPath, 'Ignored.txt');

  before(async () => {
    async function createFile(name: string, content: string) {
      try {
        // Create untracked test files
        let handle = await fsPromises.open(name, 'w');
        await handle.appendFile(content);
        await handle.close();
      } catch (err) {
        console.error(err);
      }
    }

    await createFile(untrackedFile, 'This file should not be tracked by version control');
    await createFile(ignoredFile, 'This file should be ignored by version control');
  });

  after(async () => {
    // Remove untracked test file
    try {
      await fsPromises.unlink(untrackedFile);
      await fsPromises.unlink(ignoredFile);
    } catch (err) {
      console.error(`${untrackedFile} did not exist`);
    }
  });

  describe('getVersionControlProperties', () => {
    describe('appmap.version_control.is_tracked', () => {
      test('is true for tracked file', async () => {
        const props = await getVersionControlProperties(trackedFile);

        assert.strictEqual(props['appmap.version_control.is_tracked'], true);
      });

      test('is false for untracked file', async () => {
        const props = await getVersionControlProperties(untrackedFile);

        assert.strictEqual(props['appmap.version_control.is_tracked'], false);
      });

      test('is false for ignored file', async () => {
        const props = await getVersionControlProperties(ignoredFile);

        assert.strictEqual(props['appmap.version_control.is_tracked'], false);
      });
    });

    describe('appmap.version_control.is_ignored', () => {
      test('is false for tracked file', async () => {
        const props = await getVersionControlProperties(trackedFile);

        assert.strictEqual(props['appmap.version_control.is_ignored'], false);
      });

      test('is false for untracked file', async () => {
        const props = await getVersionControlProperties(untrackedFile);

        assert.strictEqual(props['appmap.version_control.is_ignored'], false);
      });

      test('is true for ignored file', async () => {
        const props = await getVersionControlProperties(ignoredFile);

        assert.strictEqual(props['appmap.version_control.is_ignored'], true);
      });
    });

    describe('appmap.version_control.repository_type', () => {
      test('is set to "git"', async () => {
        const props = await getVersionControlProperties(trackedFile);

        assert.strictEqual(props['appmap.version_control.repository_type'], 'git');
      });
    });

    describe('appmap.version_control.repository_id', () => {
      test('is set to sha hash of origin', async () => {
        const props = await getVersionControlProperties(trackedFile);

        assert.strictEqual(
          /^[a-f0-9]{64}$/.test(props['appmap.version_control.repository_id'] as string),
          true
        );
      });
    });
  });
});
