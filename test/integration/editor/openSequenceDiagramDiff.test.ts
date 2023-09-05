// @project project-diagram-diff

import * as vscode from 'vscode';
import { initializeWorkspace, waitFor, waitForExtension, ProjectDiagramDiff } from '../util';
import AppMapService from '../../../src/appMapService';
import assert from 'assert';
import { join } from 'path';

const SEQUENCE_DIAGRAM_DIFF_PATH = join(
  ProjectDiagramDiff,
  'data/diff/minitest/Users_edit_unsuccessful_edit.diff.sequence.json'
);

describe('AppMapEditorProvider', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('opens a sequence diagram diff', async () => {
    const extension = vscode.extensions.getExtension<AppMapService>('appland.appmap');
    assert(extension);
    const { editorProvider } = extension.exports;
    await waitFor('All editors should be closed', () => editorProvider.openDocuments.length === 0);

    await vscode.commands.executeCommand(
      'vscode.open',
      vscode.Uri.file(SEQUENCE_DIAGRAM_DIFF_PATH)
    );

    await waitFor(
      'AppMap diagram should be opened',
      () => editorProvider.openDocuments.length === 1
    );
  });
});
