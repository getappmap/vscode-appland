import assert from 'assert';
import * as vscode from 'vscode';
import {
  hasDiagnostics,
  initializeWorkspace,
  waitFor,
  waitForExtension,
  withAuthenticatedUser,
} from '../util';

describe('Findings', () => {
  withAuthenticatedUser();

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

    // type: [Uri, Diagnostic[]][];
    const workspaceFolder = (vscode.workspace.workspaceFolders || [])[0];
    assert(workspaceFolder);
    const diagnostics = vscode.languages.getDiagnostics();
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(
      diagnostics[0][0].toString(),
      `file://${workspaceFolder.uri.fsPath}/app/controllers/microposts_controller.rb`
    );
    const diagnostic = diagnostics[0][1][0];
    assert(diagnostic);

    assert.strictEqual(
      diagnostic.message,
      `Unbatched materialized SQL query: SELECT "microposts".* FROM "microposts" WHERE "microposts"."user_id" = ? ORDER BY "microposts"."created_at" DESC, app/controllers/microposts_controller.rb:5`
    );

    const { relatedInformation } = diagnostic;
    assert(relatedInformation);
    assert.deepStrictEqual(
      relatedInformation[0].location.uri.fragment,
      '{"selectedObject":"analysis-finding:a3c2342df8feae6698da11cba070d8de9a97ef9450636e2d5824120867a2c0b0"}'
    );
  });
});
