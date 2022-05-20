import { rename } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import {
  ProjectA,
  initializeWorkspace,
  touch,
  waitFor,
  appmapFiles,
  mtimeFiles,
  hasNoDiagnostics,
  hasDiagnostics,
} from '../util';

describe('Scanner', () => {
  beforeEach(initializeWorkspace);
  afterEach(initializeWorkspace);

  it('is performed as AppMaps are modified', async () => {
    await promisify(rename)(
      join(ProjectA, 'appmap-findings.json'),
      join(ProjectA, 'appmap-findings.json.bak')
    );

    await waitFor('Diagnostics were not cleared', hasNoDiagnostics);

    await Promise.all((await appmapFiles()).map((uri) => touch(uri.fsPath)));

    await waitFor(
      'AppMaps were not indexed',
      async (): Promise<boolean> => (await mtimeFiles()).length > 0
    );

    await waitFor('No Diagnostics were created', hasDiagnostics);
  });
});
