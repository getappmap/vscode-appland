import * as vscode from 'vscode';
import assert from 'assert';

describe('Smoke', () => {
  it('Should start extension appland.appmap', async () => {
    const started = vscode.extensions.getExtension('appland.appmap');
    assert.notStrictEqual(started, undefined);
    assert.strictEqual(started?.isActive, true);
  });
});
