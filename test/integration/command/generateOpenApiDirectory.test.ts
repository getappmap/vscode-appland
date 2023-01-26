// @project project-appmap-dir

import assert from 'assert';
import * as vscode from 'vscode';
import { GenerateOpenApi } from '../../../src/commands/generateOpenApi';
import { retry } from '../../../src/util';
import { waitForExtension } from '../util';

function isTextEditorOpen() {
  if (!vscode.window.activeTextEditor) {
    throw new Error(`waiting for generated OpenAPI definitions`);
  }
}

describe('OpenAPI generation', () => {
  before(async () => {
    await waitForExtension();
    vscode.commands.executeCommand(GenerateOpenApi, vscode.ViewColumn.Active);
    await retry(isTextEditorOpen, 20, 500);
  });

  it('respects `appmap_dir` in appmap.yml', async () => {
    const { activeTextEditor } = vscode.window;
    const textContent = activeTextEditor?.document.getText() || '';
    assert.match(textContent, /\/good/g);
    assert.doesNotMatch(textContent, /\\this_route_shouldnt_exist/g);
  });
});
