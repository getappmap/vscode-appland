import assert from 'assert';
import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import AppMapProperties from '../../src/appmapProperties';
import ProjectWatcher from '../../src/projectWatcher';
import QuickstartDocsInstallAgent from '../../src/quickstart-docs/installAgentWebview';
import MockExtensionContext from '../mocks/mockExtensionContext';
import MockFileSystemWatcher from '../mocks/mockFileSystemWatcher';
import { mockSingleProjectWorkspace } from '../mocks/mockWorkspace';

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

    it('from a fresh installation', async function() {
      this.skip();

      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      sinon.stub(vscode.env, 'isNewAppInstall').value(true);
      properties = new AppMapProperties(context);
      mockSingleProjectWorkspace(sinon, 'rb');
      projects = (vscode.workspace.workspaceFolders || []).map(
        (folder) => new ProjectWatcher(context, folder, appmapWatcher, properties)
      );

      assert(properties.hasSeenQuickStartDocs === false);
      await QuickstartDocsInstallAgent.register(context, properties, projects);
      assert(executeCommand.calledWith('appmap.openQuickstartDocsInstallAgent'));
      assert(properties.hasSeenQuickStartDocs);
    });

    it('from an existing installation', async function() {
      this.skip();

      const executeCommand = sinon.spy(vscode.commands, 'executeCommand');
      sinon.stub(vscode.env, 'isNewAppInstall').value(false);
      properties = new AppMapProperties(context);
      mockSingleProjectWorkspace(sinon, 'rb');
      projects = (vscode.workspace.workspaceFolders || []).map(
        (folder) => new ProjectWatcher(context, folder, appmapWatcher, properties)
      );

      assert(properties.hasSeenQuickStartDocs === false);
      await QuickstartDocsInstallAgent.register(context, properties, projects);
      assert(executeCommand.calledWith('appmap.openQuickstartDocsInstallAgent') === false);
      assert(properties.hasSeenQuickStartDocs === false);
    });
  });
});
