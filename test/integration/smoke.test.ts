import * as vscode from 'vscode';
import assert from 'assert';
import { waitForExtension } from './util';

describe('Smoke', () => {
  it('Should start extension appland.appmap', async () => {
    await waitForExtension();

    const extension = vscode.extensions.getExtension('appland.appmap');
    assert(extension);
    assert.deepStrictEqual(Object.keys(extension.exports), [
      'localAppMaps',
      'findings',
      'classMap',
    ]);
  });
});
