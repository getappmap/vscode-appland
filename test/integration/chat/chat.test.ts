import assert from 'assert';
import sinon from 'sinon';

import * as vscode from 'vscode';
import { initializeWorkspaceServices } from '../../../src/services/workspaceServices';
import ChatSearchWebview from '../../../src/webviews/chatSearchWebview';
import { initializeWorkspace, waitForExtension, withAuthenticatedUser } from '../util';

describe('chat', () => {
  let sandbox: sinon.SinonSandbox;
  let chatSearchWebview: ChatSearchWebview;

  withAuthenticatedUser();

  before(async () => {
    await initializeWorkspace();
    const extension = await waitForExtension();
    chatSearchWebview = await extension.chatSearchWebview;
    initializeWorkspaceServices();
  });

  beforeEach(() => (sandbox = sinon.createSandbox()));
  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    sandbox.restore();
  });

  describe('appmap.explain', () => {
    it('opens a Chat + Search view', async () => {
      await vscode.commands.executeCommand('appmap.explain');
      assert(chatSearchWebview.currentWebview);
    });
  });
});
