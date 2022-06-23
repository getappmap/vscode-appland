import * as vscode from 'vscode';
import assert from 'assert';
import { waitForExtension } from './util';

describe('Extension API', () => {
  it('should be provided by appland.appmap', async () => {
    await waitForExtension();

    const extension = vscode.extensions.getExtension('appland.appmap');
    assert(extension);
    assert.deepStrictEqual(Object.keys(extension.exports), [
      'editorProvider',
      'localAppMaps',
      'autoIndexService',
      'autoScanService',
      'sourceFileWatcher',
      'configWatcher',
      'workspaceServices',
      'uptodate',
      'findings',
      'classMap',
      'processService',
      'extensionState',
      'runtimeAnalysisCta',
    ]);
  });
});
