import assert from 'assert';
import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import { hasPreviouslyInstalledExtension } from '../../src/util';

describe('Utility methods', () => {
  describe('hasPreviouslyInstalledExtension', () => {
    let sinon: SinonSandbox;

    beforeEach(() => {
      sinon = createSandbox();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('returns true when another installation exists', async () => {
      sinon.stub(vscode.extensions, 'all').value([
        {
          extensionUri: vscode.Uri.file('/home/user/.vscode/extensions/appland.appmap-0.0.0-dev'),
        },
      ]);

      assert(hasPreviouslyInstalledExtension('/home/user/.vscode/extensions/appland.appmap-1.0.0'));
    });

    it('returns false when another installation does not exist', () => {
      sinon
        .stub(vscode.extensions, 'all')
        .value([
          { extensionUri: vscode.Uri.file('/home/user/.vscode/extensions/something-else') },
          { extensionUri: vscode.Uri.file('/home/user/.vscode/extensions/unrelated') },
        ]);

      assert(hasPreviouslyInstalledExtension('/home/user/.vscode/extensions/appland.appmap-1.0.0'));
    });
  });
});
