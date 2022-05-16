import assert from 'assert';
import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import ExtensionState from '../../src/configuration/extensionState';
import MockExtensionContext from '../mocks/mockExtensionContext';
import MockFileSystemWatcher from '../mocks/mockFileSystemWatcher';
import { mockSingleProjectWorkspace } from '../mocks/mockWorkspace';
import * as util from '../../src/util';
import registerWorkspaceOverview from '../../src/webviews/projectPickerWebview';

// KEG: These tests are not being run currently, because they directly run operations
// like registerWorkspaceOverview that are already run by vscode when the extension loads.
// It looks like these tests were originally run in a workspace context in which the
// AppMap extension was not loaded, so they passed.
//
// To re-enable them, either (a) mock out VSCode completely or (b) run them in a context
// that doesn't have the AppMap extension running.
describe('Install guide', () => {
  describe('First time flow', () => {
    let sinon: SinonSandbox;
    let appmapWatcher: MockFileSystemWatcher;
    let context: MockExtensionContext;
    let properties: ExtensionState;

    beforeEach(() => {
      sinon = createSandbox();
      context = new MockExtensionContext();
      appmapWatcher = new MockFileSystemWatcher();
    });

    afterEach(() => {
      appmapWatcher.dispose();
      context.dispose();
      sinon.restore();
    });

    it('automatically opens install guide from a fresh installation', async () => {
      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(false);
      properties = new ExtensionState(context);
      mockSingleProjectWorkspace(sinon);

      assert(properties.hasViewedInstallGuide === false);
      await registerWorkspaceOverview(context, properties);
      assert(executeCommand.calledWith('appmap.openWorkspaceOverview'));
      assert(properties.hasViewedInstallGuide);
    });

    it('does not automatically open quickstart from an existing installation', async () => {
      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(true);
      properties = new ExtensionState(context);
      mockSingleProjectWorkspace(sinon);

      assert(properties.hasViewedInstallGuide === false);
      await registerWorkspaceOverview(context, properties);
      assert(executeCommand.calledWith('appmap.openWorkspaceOverview') === false);
      assert(properties.hasViewedInstallGuide === false);
    });

    async function withExtensionVersion(version: string, shouldOpen: boolean): Promise<void> {
      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      properties = new ExtensionState(context);
      sinon.stub(properties, 'firstVersionInstalled').value(version);
      mockSingleProjectWorkspace(sinon);

      assert(properties.hasViewedInstallGuide === false);
      await registerWorkspaceOverview(context, properties);

      assert(executeCommand.calledWith('appmap.openWorkspaceOverview') === shouldOpen);
      assert(properties.hasViewedInstallGuide === shouldOpen);
    }

    it('does not automatically open quickstart if first version less than 0.15.0', async () => {
      await withExtensionVersion('0.14.4', false);
    });

    it('automatically opens quickstart if first version equal to 0.15.0', async () => {
      await withExtensionVersion('0.15.0', true);
    });

    it('automatically opens quickstart if first version greater than 0.15.0', async () => {
      await withExtensionVersion('0.16.1', true);
    });

    it('automatically opens quickstart if first version is a release candidate', async () => {
      await withExtensionVersion('0.15.0-rc1', true);
    });

    it('does not open quickstart if first version is unknown', async () => {
      await withExtensionVersion('unknown', false);
    });
  });
});
