import * as vscode from 'vscode';
import { initializeWorkspace, waitFor, ExampleAppMap, waitForExtension } from '../util';
import assert from 'assert';
import AppMapService from '../../../src/appMapService';

describe('AppMapEditorProvider', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('opens an AppMap by source path and initial state', async () => {
    const extension = vscode.extensions.getExtension<AppMapService>('appland.appmap');
    assert(extension);
    const { editorProvider } = extension.exports;

    await waitFor('All text editors should be closed', () => {
      return (
        vscode.window.visibleTextEditors.length === 0 && editorProvider.openDocuments.length === 0
      );
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
    const uri = vscode.Uri.file(ExampleAppMap);

    await vscode.commands.executeCommand('appmap.open', uri, state);

    await waitFor('AppMap diagram should be opened', () => editorProvider.openDocuments.length > 0);

    let clipboardContents: string | undefined;
    await waitFor('AppMap state should match the instructed state', async (): Promise<boolean> => {
      await vscode.commands.executeCommand('appmap.getAppmapState');
      clipboardContents = await vscode.env.clipboard.readText();
      if (!clipboardContents) return false;
      try {
        assert.deepStrictEqual(
          clipboardContents,
          'eyJjdXJyZW50VmlldyI6InZpZXdGbG93Iiwic2VsZWN0ZWRPYmplY3QiOiJldmVudDo0MSIsImZpbHRlcnMiOnsibGltaXRSb290RXZlbnRzIjpmYWxzZX19'
        );
        return true;
      } catch (e) {
        // This happens normally as the view opens with a default state, and is subsequently reconfigured.
        // console.log(`Clipboard state does not match expectation: ${e.message}`);
        return false;
      }
    });
  });
});
