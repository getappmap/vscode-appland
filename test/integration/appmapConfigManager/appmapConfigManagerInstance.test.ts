// @project tmpdir
import * as vscode from 'vscode';
import { join } from 'path';
import { waitFor, waitForExtension } from '../util';
import { AppmapConfigManagerInstance } from '../../../src/services/appmapConfigManager';
import { mkdir, readdir, rename, rm, writeFile } from 'fs/promises';
import { expect } from 'chai';
import Sinon from 'sinon';

describe('AppmapConfigWatcherInstance', () => {
  let instance: AppmapConfigManagerInstance;
  let deeplyNestedDir: string;
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0] as vscode.WorkspaceFolder;

  beforeEach(async () => {
    deeplyNestedDir = join(workspaceFolder.uri.fsPath, 'a', 'deeply', 'nested', 'directory');

    await mkdir(deeplyNestedDir, { recursive: true });
    await writeFile(join(deeplyNestedDir, 'appmap.yml'), 'name: example');

    const { configManager } = await waitForExtension();
    instance = await configManager.create(workspaceFolder);
  });

  afterEach(async () => {
    instance.dispose();

    // Clean up our temp directory for the next test
    const files = await readdir(workspaceFolder.uri.fsPath);
    await Promise.all(
      files.map((file) => vscode.workspace.fs.delete(vscode.Uri.file(file), { recursive: true }))
    );
  });

  describe('polling', () => {
    it('identifies recursive deletions', async () => {
      // Private variable access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((instance as any)._configMtimes.size).to.equal(1);
      expect(instance.workspaceConfigs.length).to.equal(1);
      await rm(deeplyNestedDir, { recursive: true });
      await waitFor('polling to pick up changes', () => instance.workspaceConfigs.length === 0);
    });

    // This test is really odd on Linux. Sometimes the file watcher picks up the change and sometimes it doesn't.
    it('identifies recursive renaming', async () => {
      expect(instance.workspaceConfigs.length).to.equal(1);
      expect(instance.workspaceConfigs[0].configFolder).to.equal(deeplyNestedDir);

      const newDir = join(workspaceFolder.uri.fsPath, 'new-dir');
      await rename(deeplyNestedDir, newDir);

      await waitFor('the config to update', () =>
        instance.workspaceConfigs.some((config) => config.configFolder === newDir)
      );

      expect(instance.workspaceConfigs.length).to.equal(1);

      // Private variable access. Make sure old directory is removed from the cache.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((instance as any)._configMtimes.size).to.equal(1);
    });

    it('does not re-emit a change caught by the file watcher', async () => {
      const stub = Sinon.stub();
      instance.onConfigChanged(stub);

      expect(stub.called).to.be.false;

      await writeFile(join(deeplyNestedDir, 'appmap.yml'), 'name: new-example');

      await waitFor('the changes to be emitted', () => stub.called);

      // Ensure enough time has passed for the polling to have run
      await new Promise((resolve) => setTimeout(resolve, 2_600));

      expect(stub.calledOnce).to.be.true;
    });
  });
});
