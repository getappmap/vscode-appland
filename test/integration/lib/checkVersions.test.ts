import assert from 'assert';
import * as vscode from 'vscode';
import * as semver from 'semver';
import { SinonSandbox, SinonStub, createSandbox } from 'sinon';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import { checkVersions } from '../../../src/lib/checkVersions';

describe('Check VSCode and extension versions', () => {
  let sinon: SinonSandbox;
  let context: MockExtensionContext;
  let showWarningMessageStub: SinonStub;
  let executeCommandStub: SinonStub;

  beforeEach(() => {
    sinon = createSandbox();
    context = new MockExtensionContext();

    showWarningMessageStub = sinon.stub(vscode.window, 'showWarningMessage');
    showWarningMessageStub.resolves('Update Now' as unknown as vscode.MessageItem);
    executeCommandStub = sinon.stub(vscode.commands, 'executeCommand');
  });

  afterEach(() => {
    context.dispose();
    sinon.restore();
  });

  it('warning shown when both versions are old', async () => {
    // Can't replace vscode.version
    // sinon.replaceGetter(vscode, 'version', () => '1.82');
    const minVersions = {
      vsCode: semver.inc(vscode.version, 'minor') ?? undefined,
      extension: '0.118.2',
    };
    sinon.replace(context.extension.packageJSON, 'version', '0.118.0');
    await checkVersions(context, minVersions);
    assert.equal(showWarningMessageStub.callCount, 1);
    assert.equal(
      showWarningMessageStub.firstCall.args[0],
      `Update Required: Please update VSCode to v${minVersions.vsCode} or higher` +
        ` and AppMap extension to v${minVersions.extension} or higher.`
    );
    assert.equal(executeCommandStub.callCount, 1);
    assert.equal(executeCommandStub.firstCall.args[0], 'update.checkForUpdate');
  });

  it('warning shown when only extension version is old', async () => {
    const minVersions = {
      vsCode: vscode.version,
      extension: '0.118.2',
    };
    sinon.replace(context.extension.packageJSON, 'version', '0.118.0');
    await checkVersions(context, minVersions);
    assert.equal(showWarningMessageStub.callCount, 1);
    assert.equal(
      showWarningMessageStub.firstCall.args[0],
      `Update Required: Please update AppMap extension to v${minVersions.extension} or higher.`
    );
    assert.equal(executeCommandStub.callCount, 1);
    assert.equal(
      executeCommandStub.firstCall.args[0],
      'workbench.extensions.action.checkForUpdates'
    );
  });

  it('no warning when versions are up to date', async () => {
    await checkVersions(context, {
      vsCode: vscode.version,
      extension: context.extension.packageJSON.version,
    });
    assert(showWarningMessageStub.notCalled);
    assert(executeCommandStub.notCalled);
  });
});
