// @project project-openapi

import assert from 'assert';
import * as vscode from 'vscode';
import { GenerateOpenApi } from '../../../src/commands/generateOpenApi';
import { retry } from '../../../src/util';
import { waitForExtension } from '../util';
import YAML from 'yaml';

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

  it('opens a new window containing AppMap generated OpenAPI definitions', async () => {
    const { activeTextEditor } = vscode.window;
    const firstLine = activeTextEditor?.document.getText(new vscode.Range(0, 0, 1, 0)).trim();
    assert.deepStrictEqual(
      firstLine,
      '# This document can be generated with the following command:'
    );
  });

  it('is correctly identified as a YAML document', async () => {
    const { activeTextEditor } = vscode.window;
    assert.deepStrictEqual(activeTextEditor?.document.languageId, 'yaml');
  });

  it('contains a valid syntax', async () => {
    const { activeTextEditor } = vscode.window;
    const text = activeTextEditor?.document.getText();
    if (!text) throw new Error('No text document is available');
    assert.doesNotThrow(() => YAML.parse(text));
  });
});
