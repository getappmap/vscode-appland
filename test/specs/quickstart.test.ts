import assert from 'assert';
import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import AppMapProperties from '../../src/appmapProperties';
import ProjectWatcher from '../../src/projectWatcher';
import QuickstartDocsInstallAgent from '../../src/quickstart-docs/installAgentWebview';
import MockExtensionContext from '../mocks/mockExtensionContext';
import MockFileSystemWatcher from '../mocks/mockFileSystemWatcher';
import { mockSingleProjectWorkspace } from '../mocks/mockWorkspace';
import * as util from '../../src/util';

describe('Quickstart', () => {
  describe('First time flow', () => {
    let sinon: SinonSandbox;
    let appmapWatcher: MockFileSystemWatcher;
    let context: MockExtensionContext;
    let properties: AppMapProperties;
    let projects: ProjectWatcher[];

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

    it('automatically opens quickstart from a fresh installation', async () => {
      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(false);
      properties = new AppMapProperties(context);
      mockSingleProjectWorkspace(sinon);
      projects = (vscode.workspace.workspaceFolders || []).map(
        (folder) => new ProjectWatcher(context, folder, appmapWatcher, properties)
      );

      assert(properties.hasSeenQuickStartDocs === false);
      await QuickstartDocsInstallAgent.register(context, properties, projects);
      assert(executeCommand.calledWith('appmap.openQuickstartDocsInstallAgent'));
      assert(properties.hasSeenQuickStartDocs);
    });

    it('does not automatically open quickstart from an existing installation', async () => {
      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      sinon.stub(util, 'hasPreviouslyInstalledExtension').returns(true);
      properties = new AppMapProperties(context);
      mockSingleProjectWorkspace(sinon);
      projects = (vscode.workspace.workspaceFolders || []).map(
        (folder) => new ProjectWatcher(context, folder, appmapWatcher, properties)
      );

      assert(properties.hasSeenQuickStartDocs === false);
      await QuickstartDocsInstallAgent.register(context, properties, projects);
      assert(executeCommand.calledWith('appmap.openQuickstartDocsInstallAgent') === false);
      assert(properties.hasSeenQuickStartDocs === false);
    });

    async function withExtensionVersion(version: string, shouldOpen: boolean): Promise<void> {
      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      properties = new AppMapProperties(context);
      sinon.stub(properties, 'firstVersionInstalled').value(version);
      mockSingleProjectWorkspace(sinon);
      projects = (vscode.workspace.workspaceFolders || []).map(
        (folder) => new ProjectWatcher(context, folder, appmapWatcher, properties)
      );

      assert(properties.hasSeenQuickStartDocs === false);
      await QuickstartDocsInstallAgent.register(context, properties, projects);
      assert(executeCommand.calledWith('appmap.openQuickstartDocsInstallAgent') === shouldOpen);
      assert(properties.hasSeenQuickStartDocs === shouldOpen);
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
