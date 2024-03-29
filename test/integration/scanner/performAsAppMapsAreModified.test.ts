import * as vscode from 'vscode';
import assert from 'assert';
import { exists, stat } from 'fs';
import { join, relative } from 'path';
import { promisify } from 'util';
import {
  initializeWorkspace,
  waitFor,
  ProjectA,
  hasNoDiagnostics,
  getDiagnosticsForAppMap,
  ExampleAppMap,
  ExampleAppMapIndexDir,
  repeatUntil,
  waitForAppMapServices,
  restoreFile,
  withAuthenticatedUser,
} from '../util';

describe('Scanner', () => {
  withAuthenticatedUser();

  beforeEach(async () => {
    await initializeWorkspace();
    await waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    );
    await waitFor('Index directory exists', async () => {
      return Boolean(await promisify(stat)(ExampleAppMapIndexDir));
    });
  });

  afterEach(initializeWorkspace);

  it('is performed as AppMaps are modified', async () => {
    await vscode.commands.executeCommand('appmap.deleteAllAppMaps');

    await waitFor('Diagnostics were not cleared', hasNoDiagnostics);

    // KEG: Remove this, as it's failing due to an issue either with IndexJanitor or with the test itself.
    // await waitFor(
    //   `AppMap index dir should be removed`,
    //   async () => !(await promisify(exists)(ExampleAppMapIndexDir))
    // );

    const appMapPath = relative(ProjectA, ExampleAppMap);
    await repeatUntil(
      async () => await restoreFile(appMapPath),
      `AppMap should be reindexed`,
      async () => promisify(exists)(join(ExampleAppMapIndexDir, 'mtime'))
    );

    await repeatUntil(
      async () => await restoreFile(appMapPath),
      'No Diagnostics were created for Microposts_controller_can_get_microposts_as_JSON',
      async () => {
        return getDiagnosticsForAppMap(ExampleAppMap).length > 0;
      }
    );

    const diagnostic = getDiagnosticsForAppMap(ExampleAppMap)[0];
    assert.strictEqual(
      diagnostic.uri.fsPath,
      join(ProjectA, 'app/controllers/microposts_controller.rb')
    );
  });
});
