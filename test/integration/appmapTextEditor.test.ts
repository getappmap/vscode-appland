import * as vscode from 'vscode';
import { FixtureDir, initializeWorkspace, waitFor } from './util';
import { join } from 'path';
import assert, { AssertionError } from 'assert';

describe('AppMapTextEditor', () => {
  beforeEach(initializeWorkspace);
  afterEach(initializeWorkspace);

  it('should open an AppMap by source path and initial state', async () => {
    await waitFor(
      'All text editors should be closed',
      () => vscode.window.visibleTextEditors.length === 0
    );

    let appmapOpened = false;
    vscode.workspace.onDidOpenTextDocument((doc) => {
      if (doc.fileName.endsWith('appmap.json')) {
        appmapOpened = true;
      }
    });

    const state = {
      currentView: 'viewFlow',
      selectedObject: 'event:41',
      filters: {
        hideElapsedTimeUnder: false,
        hideMediaRequests: true,
        hideName: false,
        hideUnlabeled: false,
        limitRootEvents: false,
      },
    };
    const uri = vscode.Uri.parse(
      `file://${join(
        FixtureDir,
        'tmp/appmap/minitest/Microposts_controller_can_get_microposts_as_JSON.appmap.json'
      )}#${JSON.stringify(state)}`
    );

    await vscode.commands.executeCommand('vscode.open', uri);

    await waitFor('AppMap diagram should be opened', () => appmapOpened);

    let clipboardContents: string | undefined;
    await waitFor(
      'AppMap state should match the instructed state',
      async (): Promise<boolean> => {
        await vscode.commands.executeCommand('appmap.getAppmapState');
        clipboardContents = await vscode.env.clipboard.readText();
        if (!clipboardContents) return false;
        try {
          assert.deepStrictEqual(JSON.parse(clipboardContents), state);
          return true;
        } catch (e) {
          // This happens normally as the view opens with a default state, and is subsequently reconfigured.
          // console.log(`Clipboard state does not match expectation: ${e.message}`);
          return false;
        }
      }
    );

    clipboardContents = await vscode.env.clipboard.readText();
    if (!clipboardContents)
      throw new AssertionError({
        message: 'Clipboard text is null or undefined',
      });

    assert.deepStrictEqual(JSON.parse(clipboardContents), state);
  });
});
