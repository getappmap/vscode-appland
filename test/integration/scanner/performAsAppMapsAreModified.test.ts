import * as vscode from 'vscode';
import assert from 'assert';
import { exists, rename } from 'fs';
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
} from '../util';

describe('Scanner', () => {
  beforeEach(initializeWorkspace);
  beforeEach(
    waitForAppMapServices.bind(
      null,
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    )
  );
  afterEach(initializeWorkspace);

  it('is performed as AppMaps are modified', async () => {
    await promisify(rename)(
      join(ProjectA, 'appmap-findings.json'),
      join(ProjectA, 'appmap-findings.json.bak')
    );

    await vscode.commands.executeCommand('appmap.deleteAllAppMaps');
    await waitFor('Diagnostics were not cleared', hasNoDiagnostics);

    await waitFor(
      `AppMap index dir should be removed`,
      async () => !(await promisify(exists)(ExampleAppMapIndexDir))
    );

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
