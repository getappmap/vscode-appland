import * as vscode from 'vscode';
import { initializeWorkspace, touch, waitFor } from '../util';

describe('AppMapIndex', () => {
  beforeEach(initializeWorkspace);
  afterEach(initializeWorkspace);

  it('updates as AppMaps are modified', async () => {
    const appmapFiles = await vscode.workspace.findFiles(`**/*.appmap.json`);
    await Promise.all(appmapFiles.map((uri) => touch(uri.fsPath)));

    const mtimeFiles = async () => vscode.workspace.findFiles(`**/mtime`);

    return new Promise((resolve, reject) => {
      waitFor(
        'No mtime (AppMap timestamp) files found',
        async () => (await mtimeFiles()).length > 0
      ).catch(reject);

      mtimeFiles()
        .then((files) => console.log(files))
        .then(resolve)
        .catch(reject);
    });
  });
});
