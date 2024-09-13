import assert from 'assert';
import { promises as fs } from 'fs';
import sinon from 'sinon';

import path from 'path';
import * as vscode from 'vscode';
import { initializeWorkspaceServices } from '../../../src/services/workspaceServices';
import ChatSearchWebview from '../../../src/webviews/chatSearchWebview';
import { initializeWorkspace, waitForExtension, withAuthenticatedUser, withTmpDir } from '../util';

type PinFileEvent = {
  type: string;
  location: string;
  content: string;
};

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
    vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    sandbox.restore();
  });

  describe('appmap.explain', () => {
    it('opens a Chat + Search view', async () => {
      await vscode.commands.executeCommand('appmap.explain');
      assert(chatSearchWebview.currentWebview);
    });
  });

  describe('once the Chat is opened', () => {
    let chatView: vscode.Webview;

    beforeEach(async () => {
      await vscode.commands.executeCommand('appmap.explain');
      const v = chatSearchWebview.currentWebview;
      assert(v);

      await new Promise<void>((resolve) => {
        v.onDidReceiveMessage(async (msg) => {
          if (msg.command === 'chat-search-ready') {
            resolve();
          }
        });
      });
      chatView = v;
    });

    const waitForPin = () =>
      new Promise<PinFileEvent>((resolve) => {
        chatView.onDidReceiveMessage(async (msg) => {
          if (msg.command === 'pin') {
            resolve(msg.event);
          }
        });
      });

    const expectedContent = 'Hello World!';
    const newTmpFiles = async (tmpDir: string) => {
      const fullPath = path.join(tmpDir, 'hello-world.txt');
      await fs.writeFile(fullPath, expectedContent, 'utf-8');
      return [vscode.Uri.file(fullPath)];
    };

    const verifyPinEvent = (event: PinFileEvent, files: vscode.Uri[]) => {
      assert.strictEqual(event.type, 'file');
      assert.strictEqual(event.location, files[0].path);
      assert.strictEqual(event.content, expectedContent);
    };

    describe('appmap.addToContext', () => {
      it('pins a file', async () => {
        return withTmpDir(async (tmpDir) => {
          const files = await newTmpFiles(tmpDir);
          sandbox.stub(chatSearchWebview, 'chooseFilesToPin').resolves(files);
          const p = waitForPin();
          await vscode.commands.executeCommand('appmap.addToContext');
          const event = await p;
          verifyPinEvent(event, files);
        });
      });
    });

    describe('appmap.explorer.addToContext', () => {
      it('pins a file', async () => {
        return withTmpDir(async (tmpDir) => {
          const files = await newTmpFiles(tmpDir);
          const p = waitForPin();
          await vscode.commands.executeCommand('appmap.explorer.addToContext', null, files);
          const event = await p;
          verifyPinEvent(event, files);
        });
      });
    });

    describe('appmap.editor.title.addToContext', () => {
      it('pins a file', async () => {
        return withTmpDir(async (tmpDir) => {
          const files = await newTmpFiles(tmpDir);
          const p = waitForPin();
          await vscode.commands.executeCommand('appmap.editor.title.addToContext', files[0]);
          const event = await p;
          verifyPinEvent(event, files);
        });
      });
    });
  });
});
