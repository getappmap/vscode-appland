import * as vscode from 'vscode';
import assert from 'assert';
import { waitFor } from './util';

describe('Smoke', () => {
  it('Should start extension appland.appmap', async () => {
    waitFor(`Extension not available`, () => !!vscode.extensions.getExtension('appland.appmap'));
    waitFor(
      `Extension not active`,
      () => !!vscode.extensions.getExtension('appland.appmap')?.isActive
    );

    const extension = vscode.extensions.getExtension('appland.appmap');
    assert(extension);
    assert.deepStrictEqual(Object.keys(extension.exports), [
      'localAppMaps',
      'findings',
      'classMap',
    ]);
  });
});
