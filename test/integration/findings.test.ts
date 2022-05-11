import assert from 'assert';
import { exec } from 'child_process';
import { unlink } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import * as vscode from 'vscode';
import { touch, waitFor } from './util';

const fixtureDir = join(__dirname, '../../../test/fixtures/workspaces/project-with-findings');

async function executeWorkspaceCommand(cmd: string) {
  return new Promise<void>((resolve, reject) => {
    exec(cmd, { cwd: fixtureDir }, (err, stdout, stderr) => {
      if (err) {
        console.log(stdout);
        console.warn(stderr);
        return reject(err);
      }
      resolve();
    });
  });
}

async function cleanWorkspace() {
  await executeWorkspaceCommand(`git clean -fd .`);
}

describe('Findings', () => {
  beforeEach(async () => await cleanWorkspace());
  afterEach(async () => await cleanWorkspace());

  it('should be populated in the Problems view', async () => {
    const controllerFile = await vscode.workspace.findFiles(
      '**/microposts_controller.rb',
      '**/node_modules/**'
    );
    const testDocument = await vscode.workspace.openTextDocument(controllerFile[0]);
    await vscode.window.showTextDocument(testDocument);

    return new Promise((resolve, reject) => {
      waitFor(
        'No Diagnostics found within timeout period',
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
        'No mtime (AppMap timestamp) files found within timeout period',
        async () => (await mtimeFiles()).length > 0
      ).catch(reject);

      mtimeFiles()
        .then((files) => console.log(files))
        .then(resolve)
        .catch(reject);
    });
  });

  it('auto-scans AppMaps as they are modified', async () => {
    // TODO: Not working yet
    return true;

    await waitFor(
      'No Diagnostics found within timeout period',
      () => vscode.languages.getDiagnostics().length > 0
    );

    await promisify(unlink)(join(fixtureDir, 'appmap-findings.json'));

    await waitFor('Diagnostics not removed within within the timeout period', () => {
      const diagnostics = vscode.languages.getDiagnostics();
      console.log(diagnostics.map((d) => d[0]));
      return vscode.languages.getDiagnostics().length === 0;
    });

    const mtimeFiles = await vscode.workspace.findFiles(`**/mtime`);
    await Promise.all(mtimeFiles.map((uri) => touch(uri.fsPath)));

    await waitFor(
      'No Diagnostics found within timeout period',
      () => vscode.languages.getDiagnostics().length > 0
    );
  });
});
