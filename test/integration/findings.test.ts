import assert from 'assert';
import { rename } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { ProjectA, initializeWorkspace, touch, waitFor, appmapFiles, mtimeFiles } from './util';

describe('Findings', () => {
  beforeEach(initializeWorkspace);
  afterEach(initializeWorkspace);

  const hasDiagnostics = (): boolean =>
    vscode.languages.getDiagnostics().filter((d) => d[1].length > 0).length > 0;

  const hasNoDiagnostics = (): boolean => !hasDiagnostics();

  it('should be populated in the Problems view', async () => {
    const controllerFile = await vscode.workspace.findFiles(
      '**/microposts_controller.rb',
      '**/node_modules/**'
    );
    const testDocument = await vscode.workspace.openTextDocument(controllerFile[0]);
    await vscode.window.showTextDocument(testDocument);

    await waitFor('No Diagnostics were created', hasDiagnostics);

    const diagnostics = vscode.languages.getDiagnostics();
    assert.strictEqual(
      diagnostics[0][0].toString(),
      `file:///Users/kgilpin/.rbenv/versions/3.0.2/lib/ruby/gems/3.0.0/gems/activerecord-6.0.4.1/lib/active_record/relation.rb`
    );
    assert.strictEqual(diagnostics[0][1].length, 1);
    assert.strictEqual(
      diagnostics[0][1][0].message,
      `Unbatched materialized SQL query: SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC`
    );
  });

  it('auto-index AppMaps as they are modified', async () => {
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

  it('auto-scans AppMaps as they are modified', async () => {
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
