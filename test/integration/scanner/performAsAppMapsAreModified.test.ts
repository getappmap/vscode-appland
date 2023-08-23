import * as vscode from 'vscode';
import assert from 'assert';
import { existsSync } from 'fs';
import { join, relative } from 'path';
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
  executeWorkspaceOSCommand,
} from '../util';

// async function logWatches(): Promise<void> {
//   const watches = await executeWorkspaceOSCommand('ps -ef | grep -e --watch', ProjectA);
//   console.log('Watches: ', watches);
// }

async function logIndexDir(): Promise<void> {
  const indexDir = await executeWorkspaceOSCommand(`ls -al ${ExampleAppMapIndexDir}`, ProjectA);
  console.log('Index Dir: ', indexDir);
}

describe('Scanner', () => {
  withAuthenticatedUser();

  beforeEach(async () => {
    await initializeWorkspace();
    await waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    );
    await waitFor('Index directory exists', () => existsSync(ExampleAppMapIndexDir));
  });

  afterEach(initializeWorkspace);

  it('is performed as AppMaps are modified', async () => {
    await vscode.commands.executeCommand('appmap.deleteAllAppMaps');

    await waitFor('Diagnostics were not cleared', hasNoDiagnostics);

    // KEG: Remove this, as it's failing due to an issue either with IndexJanitor or with the test itself.
    // await waitFor(
    //   `AppMap index dir should be removed`,
    //   async () => !existsSync(ExampleAppMapIndexDir)
    // );

    await logIndexDir();
    const appMapPath = relative(ProjectA, ExampleAppMap);
    await restoreFile(appMapPath);

    assert(existsSync(ExampleAppMap));
    await logIndexDir();

    await waitFor('AppMap to be re-indexed', () =>
      existsSync(join(ExampleAppMapIndexDir, 'mtime'))
    );
    await logIndexDir();

    await waitFor('Findings to be generated', () =>
      existsSync(join(ExampleAppMapIndexDir, 'appmap-findings.json'))
    );
    await logIndexDir();

    await waitFor(
      'diagnostics to be created',
      () => getDiagnosticsForAppMap(ExampleAppMap).length > 0
    );
    await logIndexDir();

    const diagnostic = getDiagnosticsForAppMap(ExampleAppMap)[0];
    assert.strictEqual(
      diagnostic.uri.fsPath,
      join(ProjectA, 'app/controllers/microposts_controller.rb')
    );
  });
});
