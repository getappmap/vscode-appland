import * as vscode from 'vscode';
import { initializeWorkspace, waitForExtension, withAuthenticatedUser } from '../util';
import { initializeWorkspaceServices } from '../../../src/services/workspaceServices';
import { expect } from 'chai';
import ChatSearchWebview from '../../../src/webviews/chatSearchWebview';

describe('appmap.explain', () => {
  withAuthenticatedUser();

  let chatSearchWebview: ChatSearchWebview;

  beforeEach(async () => {
    await initializeWorkspace();
    const extension = await waitForExtension();
    chatSearchWebview = await extension.chatSearchWebview;
    await initializeWorkspaceServices();
  });

  afterEach(initializeWorkspace);

  it('opens a Chat + Search view', async () => {
    await vscode.commands.executeCommand('appmap.explain');
    expect(chatSearchWebview.currentWebview).to.not.be.undefined;
  });
});
