import assert from 'assert';
import { rename, unlink } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { FixtureDir, initializeWorkspace, touch, waitFor } from './util';

describe('Findings', () => {
  beforeEach(initializeWorkspace);
  afterEach(initializeWorkspace);

  it('should be populated in the Problems view', async () => {
    const controllerFile = await vscode.workspace.findFiles(
      '**/microposts_controller.rb',
      '**/node_modules/**'
    );
    const testDocument = await vscode.workspace.openTextDocument(controllerFile[0]);
    await vscode.window.showTextDocument(testDocument);

    return new Promise((resolve, reject) => {
      waitFor(
        'No Diagnostics were created',
        () => vscode.languages.getDiagnostics().length > 0
      ).catch(reject);

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
      resolve();
    });
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
    await waitFor(
      'No Diagnostics were created',
      () => vscode.languages.getDiagnostics().length > 0
    );

    await promisify(rename)(
      join(FixtureDir, 'appmap-findings.json'),
      join(FixtureDir, 'appmap-findings.json.bak')
    );

    await waitFor('Diagnostics were not removed', () => {
      return vscode.languages.getDiagnostics().length === 0;
    });

    const mtimeFiles = await vscode.workspace.findFiles(`**/mtime`);
    await Promise.all(mtimeFiles.map((uri) => touch(uri.fsPath)));

    await waitFor(
      'No Diagnostics were created',
      () => vscode.languages.getDiagnostics().length > 0
    );
  });
});
