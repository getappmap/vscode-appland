import assert from 'assert';
import * as vscode from 'vscode';
import { hasDiagnostics, initializeWorkspace, waitFor, waitForExtension } from '../util';

describe('Findings', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('are populated in the Problems view', async () => {
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
      `file:///Users/kgilpin/source/appland/vscode-appland/test/fixtures/workspaces/project-a/app/controllers/microposts_controller.rb`
    );
    assert.strictEqual(diagnostics[0][1].length, 1);
    assert.strictEqual(
      diagnostics[0][1][0].message,
      `Unbatched materialized SQL query: SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC`
    );
  });
});
