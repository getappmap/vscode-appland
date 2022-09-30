import assert from 'assert';
import { unlink } from 'fs';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { touch } from '../../../src/lib/touch';
import {
  initializeWorkspace,
  repeatUntil,
  waitFor,
  waitForAppMapServices,
  withAuthenticatedUser,
} from '../util';

describe('AppMapIndex', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(
    waitForAppMapServices.bind(
      null,
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    )
  );
  afterEach(initializeWorkspace);

  it('updates as AppMaps are modified', async () => {
    const appmapFiles = (await vscode.workspace.findFiles(`**/*.appmap.json`)).map(
      (uri) => uri.fsPath
    );
    const mtimeFiles = async () => vscode.workspace.findFiles(`**/mtime`);

    waitFor(
      `AppMaps have not all been indexed`,
      async () => (await mtimeFiles()).length !== appmapFiles.length
    );

    await Promise.all((await mtimeFiles()).map(async (f) => promisify(unlink)(f.fsPath)));

    assert.strictEqual((await mtimeFiles()).length, 0, `mtime files should all be erased`);

    const appmapFileCount = (await vscode.workspace.findFiles(`**/*.appmap.json`)).length;

    const touchAppMaps = async () => Promise.all(appmapFiles.map((filePath) => touch(filePath)));
    await repeatUntil(
      touchAppMaps,
      `mtime files not created for all AppMaps`,
      async () => (await mtimeFiles()).length === appmapFileCount
    );
  });
});
