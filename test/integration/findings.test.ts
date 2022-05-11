import assert from 'assert';
import * as vscode from 'vscode';
import { waitFor } from './util';

describe('Findings', () => {
  it('should be populated in the TreeView', async () => {
    const controllerFile = await vscode.workspace.findFiles(
      '**/microposts_controller.rb',
      '**/node_modules/**'
    );
    const testDocument = await vscode.workspace.openTextDocument(controllerFile[0]);
    await vscode.window.showTextDocument(testDocument);

    return new Promise((resolve, reject) => {
      waitFor(
        'No Diagnostics found within timeout period'
        (): boolean => vscode.languages.getDiagnostics().length > 0,
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
});
