import * as vscode from 'vscode';
import { initializeWorkspace, waitFor, waitForIndexer, withAuthenticatedUser } from '../util';
import { pathExists } from 'fs-extra';

describe('AppMapIndex', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForIndexer);
  afterEach(initializeWorkspace);

  // TODO: Restore this test once the IndexJanitor has been fixed or this test has been fixed.
  xit('cleans up index directories', async () => {
    const appmapFiles = await vscode.workspace.findFiles(`tmp/appmap/**/*.appmap.json`);
    const indexDirs = appmapFiles.map(({ fsPath }) => fsPath.replace(/\.appmap\.json$/, ''));

    await waitFor(`AppMaps have not all been indexed`, async () => {
      const mtimeFiles = await vscode.workspace.findFiles(`tmp/appmap/**/mtime`);
      return mtimeFiles.length === appmapFiles.length;
    });

    vscode.commands.executeCommand('appmap.deleteAllAppMaps');

    await waitFor(`AppMap index directories have not all been deleted`, async () => {
      const indexPresence = await Promise.all(indexDirs.map((indexDir) => pathExists(indexDir)));
      return indexPresence.every((present) => !present);
    });
  });
});
