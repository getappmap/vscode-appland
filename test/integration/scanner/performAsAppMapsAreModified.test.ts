import * as vscode from 'vscode';
import assert from 'assert';
import { existsSync, mkdirSync, rmSync } from 'fs';
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
import AppMapService from '../../../src/appMapService';

// async function logWatches(): Promise<void> {
//   const watches = await executeWorkspaceOSCommand('ps -ef | grep -e --watch', ProjectA);
//   console.log('Watches: ', watches);
// }

async function logIndexDir(): Promise<void> {
  const indexDir = await executeWorkspaceOSCommand(`ls -al ${ExampleAppMapIndexDir}`, ProjectA);
  console.log(`\nIndex Dir: ${indexDir}`);
}

describe('Scanner', () => {
  let services: AppMapService;
  withAuthenticatedUser();

  beforeEach(async () => {
    await initializeWorkspace();
    services = await waitForAppMapServices(
      'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
    );
    await waitFor('Index directory exists', () => existsSync(ExampleAppMapIndexDir));
  });

  afterEach(initializeWorkspace);

  it('is performed as AppMaps are modified', async () => {
    async function removeAndReindex() {
      await logIndexDir();
      await vscode.commands.executeCommand('appmap.deleteAllAppMaps');
      rmSync(ExampleAppMapIndexDir, { force: true, recursive: true });
      mkdirSync(ExampleAppMapIndexDir);
      await logIndexDir();

      await waitFor('AppMaps to be deleted', () => services.localAppMaps.appMaps.length === 0);
      await waitFor('Diagnostics to be cleared', hasNoDiagnostics);

      const appMapPath = relative(ProjectA, ExampleAppMap);
      await restoreFile(appMapPath);

      assert(existsSync(ExampleAppMap));

      await waitFor('AppMap to be re-indexed', () =>
        existsSync(join(ExampleAppMapIndexDir, 'mtime'))
      );
      await logIndexDir();
    }

    await removeAndReindex();

    await logIndexDir();
    await repeatUntil(removeAndReindex, 'Findings to be generated', () =>
      existsSync(join(ExampleAppMapIndexDir, 'appmap-findings.json'))
    );
    await logIndexDir();

    await waitFor(
      'diagnostics to be created',
      () => getDiagnosticsForAppMap(ExampleAppMap).length > 0
    );

    const diagnostic = getDiagnosticsForAppMap(ExampleAppMap)[0];
    assert.strictEqual(
      diagnostic.uri.fsPath,
      join(ProjectA, 'app/controllers/microposts_controller.rb')
    );
    assert(false);
  });
});
