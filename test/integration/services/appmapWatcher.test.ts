import { assert } from 'console';
import * as vscode from 'vscode';
import { AppMapWatcher } from '../../../src/services/appmapWatcher';

describe('WorkspaceService', () => {
  it('informs the listener when it is initializing', async () => {
    const service = new AppMapWatcher();
    return new Promise((resolve) => {
      service.onCreate((event) => {
        assert(event.initializing === true);
        resolve();
      });

      const workspaceFolder = vscode.workspace.workspaceFolders?.at(0) as vscode.WorkspaceFolder;
      service.create(workspaceFolder);
    });
  });
});
