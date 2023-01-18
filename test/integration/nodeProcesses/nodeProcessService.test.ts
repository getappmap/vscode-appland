import assert from 'assert';
import { NodeProcessService } from '../../../src/services/nodeProcessService';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { withTmpDir } from '../util';

describe('NodeProcessService', () => {
  describe('install', () => {
    it('creates the expected files in global storage', async () => {
      await withTmpDir(async (tmpDir) => {
        const lockFile = `${tmpDir}.lock`;
        const extensionContext = {
          globalStorageUri: vscode.Uri.parse(tmpDir),
          extensionPath: path.join(__dirname, '..', '..', '..', '..'),
        } as vscode.ExtensionContext;

        const service = new NodeProcessService(extensionContext);
        await service.install();
        await fs.stat(path.join(tmpDir, 'node_modules'));
        await fs.stat(path.join(tmpDir, 'yarn.lock'));
        await fs.stat(path.join(tmpDir, 'yarn.js'));
        await fs.stat(path.join(tmpDir, 'package.json'));

        // This file shouldn't exist. If it does, our process environment was not overridden.
        await assert.rejects(fs.stat(path.join(tmpDir, 'bad.lock')));
        await assert.rejects(fs.stat(lockFile));
      });
    });

    it('yields installation to another process if it cannot acquire a lock', async () => {
      await withTmpDir(async (tmpDir) => {
        const lockFile = `${tmpDir}.lock`;
        try {
          await fs.writeFile(lockFile, '');

          const extensionContext = {
            globalStorageUri: vscode.Uri.parse(tmpDir),
            extensionPath: path.join(__dirname, '..', '..', '..', '..'),
          } as vscode.ExtensionContext;

          const service = new NodeProcessService(extensionContext);
          service.install();
          await new Promise((resolve) => service.onReady(resolve));

          await assert.rejects(async () => {
            // This file shouldn't exist because installation was yielded to a fake process
            await fs.stat(path.join(tmpDir, 'yarn.js'));
          });
        } finally {
          await fs.rm(lockFile);
        }
      });
    });
  });
});
