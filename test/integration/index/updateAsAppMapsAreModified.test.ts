import assert from 'assert';
import { unlink } from 'fs';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { touch } from '../../../src/util';
import { initializeWorkspace, repeatUntil, waitForAppMapServices } from '../util';

describe('AppMapIndex', () => {
  beforeEach(initializeWorkspace);
  beforeEach(() =>
    waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    )
  );
  afterEach(initializeWorkspace);

  it('updates as AppMaps are modified', async () => {
    const mtimeFiles = async () => vscode.workspace.findFiles(`**/mtime`);
    await Promise.all((await mtimeFiles()).map(async (f) => promisify(unlink)(f.fsPath)));
    assert.strictEqual((await mtimeFiles()).length, 0, `mtime files should all be erased`);

    const appmapFileCount = (await vscode.workspace.findFiles(`**/*.appmap.json`)).length;
    const appmapFiles = (await vscode.workspace.findFiles(`**/*.appmap.json`)).map(
      (uri) => uri.fsPath
    );

    const touchAppMaps = async () => Promise.all(appmapFiles.map((filePath) => touch(filePath)));
    await repeatUntil(
      touchAppMaps,
      `mtime files not created for all AppMaps`,
      async () => (await mtimeFiles()).length === appmapFileCount
    );
  });
});
