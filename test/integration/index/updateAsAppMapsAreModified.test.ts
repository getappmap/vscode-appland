import { unlink } from 'fs';
import { promisify } from 'util';
import { touch } from '../../../src/lib/touch';
import {
  initializeWorkspace,
  repeatUntil,
  waitFor,
  waitForAppMapServices,
  withAuthenticatedUser,
} from '../util';
import { findFiles } from '../../../src/lib/findFiles';

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
    const appmapFiles = (await findFiles(`tmp/appmap/**/*.appmap.json`)).map((uri) => uri.fsPath);

    const mtimeFiles = async () => await findFiles(`tmp/appmap/**/mtime`);

    await waitFor(
      `AppMaps have not all been indexed`,
      async () => (await mtimeFiles()).length === appmapFiles.length
    );

    await repeatUntil(
      async () => Promise.all((await mtimeFiles()).map(async (f) => promisify(unlink)(f.fsPath))),
      `mtime files have not all been erased`,
      async () => (await mtimeFiles()).length === 0
    );

    const appmapFileCount = (await findFiles(`**/*.appmap.json`)).length;

    const touchAppMaps = async () => Promise.all(appmapFiles.map((filePath) => touch(filePath)));
    await repeatUntil(
      touchAppMaps,
      `mtime files not created for all AppMaps`,
      async () => (await mtimeFiles()).length === appmapFileCount
    );
  });
});
