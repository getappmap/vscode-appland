import assert from 'assert';
import { exists, rename, writeFile } from 'fs';
import { glob } from 'glob';
import { join } from 'path';
import { promisify } from 'util';
import {
  initializeWorkspace,
  waitFor,
  waitForExtension,
  ProjectA,
  hasNoDiagnostics,
  touch,
  getDiagnosticsForAppMap,
  ExampleAppMap,
  ExampleAppMapIndexDir,
  repeatUntil,
  hasDiagnostics,
} from '../util';

describe('Scanner', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('is performed as AppMaps are modified', async () => {
    console.log(`Waiting for diagnostics to be present`);
    await waitFor('Diagnostics were not created', hasDiagnostics);
    console.log(`Diagnostics are present`);

    await promisify(rename)(
      join(ProjectA, 'appmap-findings.json'),
      join(ProjectA, 'appmap-findings.json.bak')
    );

    await repeatUntil(
      async () => {
        for (const findingsFile in await promisify(glob)('**/appmap-findings.json', {
          cwd: ProjectA,
        })) {
          await promisify(writeFile)(findingsFile, JSON.stringify([]));
        }
      },
      'Diagnostics were not cleared',
      hasNoDiagnostics
    );

    await repeatUntil(
      async () => touch(ExampleAppMap),
      `AppMap should be reindexed`,
      async () => promisify(exists)(join(ExampleAppMapIndexDir, 'mtime'))
    );

    await waitFor(
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
