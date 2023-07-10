import * as vscode from 'vscode';
import {
  initializeWorkspace,
  waitFor,
  waitForExtension,
  waitForIndexer,
  withAuthenticatedUser,
} from '../util';
import { pathExists } from 'fs-extra';
import type AppMapService from '../../../src/appMapService';

describe('AppMapIndex', () => {
  withAuthenticatedUser();

  let extension: AppMapService;

  beforeEach(initializeWorkspace);
  beforeEach(waitForIndexer);
  beforeEach(async () => (extension = await waitForExtension()));
  afterEach(initializeWorkspace);

  xit('cleans up index directories', async () => {
    const appmapFiles = await vscode.workspace.findFiles(`tmp/appmap/**/*.appmap.json`);
    const indexDirs = appmapFiles.map(({ fsPath }) => fsPath.replace(/\.appmap\.json$/, ''));

    await waitFor(`AppMaps have not all been indexed`, async () => {
      const mtimeFiles = await vscode.workspace.findFiles(`tmp/appmap/**/mtime`);
      return mtimeFiles.length === appmapFiles.length;
    });

    await waitFor(`AppMaps have not yet been acknowledged by the extension`, async () => {
      return extension.localAppMaps.appMaps().length === appmapFiles.length;
    });

    vscode.commands.executeCommand('appmap.deleteAllAppMaps');

    await waitFor(`AppMap index directories have not all been deleted`, async () => {
      const indexPresence = await Promise.all(indexDirs.map((indexDir) => pathExists(indexDir)));
      return indexPresence.every((present) => !present);
    });
  });
});
