import '../mock/vscode';

import { expect } from 'chai';
import sinon from 'sinon';
import type * as vscodeTypes from 'vscode';

import vscode from '../mock/vscode';

import AppMapServerAuthenticationProvider from '../../../src/authentication/appmapServerAuthenticationProvider';
import SignInViewProvider from '../../../src/webviews/signInWebview';

import MockExtensionContext from '../../mocks/mockExtensionContext';
import EventEmitter from '../mock/vscode/EventEmitter';
import { resetConfigurations } from '../mock/vscode/workspace';

interface MockWebviewView {
  view: vscodeTypes.WebviewView;
  // The provider's message handler is async and VS Code's event emitter discards what
  // listeners return, so settle its promise chain before asserting on what it posted back.
  receiveMessage(message: unknown): Promise<void>;
  messages: Record<string, unknown>[];
}

function createMockWebviewView(): MockWebviewView {
  const onDidReceiveMessage = new EventEmitter<unknown>();
  const messages: Record<string, unknown>[] = [];

  const view = {
    viewType: SignInViewProvider.viewType,
    visible: true,
    show: () => undefined,
    onDidDispose: new EventEmitter<void>().event,
    onDidChangeVisibility: new EventEmitter<void>().event,
    webview: {
      html: '',
      options: {},
      onDidReceiveMessage: onDidReceiveMessage.event,
      postMessage: async (message: Record<string, unknown>) => {
        messages.push(message);
        return true;
      },
      asWebviewUri: (uri: vscodeTypes.Uri) => uri,
      cspSource: 'mock-csp-source',
    },
  } as unknown as vscodeTypes.WebviewView;

  return {
    view,
    receiveMessage: async (msg: unknown) => {
      onDidReceiveMessage.fire(msg);
      await new Promise((resolve) => setImmediate(resolve));
    },
    messages,
  };
}

describe('SignInViewProvider', () => {
  let sandbox: sinon.SinonSandbox;
  let context: MockExtensionContext;
  let executeCommand: sinon.SinonStub;
  let webviewView: MockWebviewView;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    context = new MockExtensionContext();
    executeCommand = sandbox.stub(vscode.commands, 'executeCommand');
    vscode.workspace.getConfiguration('appMap').update('applandUrl', 'https://getappmap.com');
    delete process.env.APPMAP_CONFIG_URL;

    const authProvider = sandbox.createStubInstance(AppMapServerAuthenticationProvider);
    const provider = new SignInViewProvider(
      context,
      authProvider as unknown as AppMapServerAuthenticationProvider
    );

    webviewView = createMockWebviewView();
    provider.resolveWebviewView(webviewView.view);
  });

  afterEach(() => {
    sandbox.restore();
    context.dispose();
    resetConfigurations();
  });

  function messageOfType(type: string): Record<string, unknown> | undefined {
    return webviewView.messages.find((m) => m.type === type);
  }

  // The webview hides its "apply your organization's configuration" link when this is set, so
  // it is never set: no state the extension can read back means the configuration a user is
  // being onboarded onto is the one in force. A URL can be stale, rotated or unreachable, and
  // it is still a URL. Offering the link unconditionally costs a redundant suggestion; getting
  // it wrong costs the affordance entirely, with only the command palette left as a way in.
  describe('on init', () => {
    it('reports no organization configuration when no URL is set', async () => {
      await webviewView.receiveMessage({ command: 'sign-in-ready' });

      expect(messageOfType('init-sign-in')?.orgConfigApplied).to.be.false;
    });

    it('still reports none when a URL is set, so the link is always offered', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');

      await webviewView.receiveMessage({ command: 'sign-in-ready' });

      expect(messageOfType('init-sign-in')?.orgConfigApplied).to.be.false;
    });

    it('still reports none when the URL comes from the environment', async () => {
      process.env.APPMAP_CONFIG_URL = 'https://env.example.com/config.json';

      await webviewView.receiveMessage({ command: 'sign-in-ready' });

      expect(messageOfType('init-sign-in')?.orgConfigApplied).to.be.false;
    });
  });

  describe('on apply-org-config', () => {
    it('runs the organization configuration command', async () => {
      await webviewView.receiveMessage({ command: 'apply-org-config' });

      expect(executeCommand.calledWith('appmap.setConfigurationUrl')).to.be.true;
    });

    // The Local File option applies a one-shot configuration and sets no URL, so the reply
    // has to come from what the command actually did. Reading it back off the URL reports
    // "not applied" for a successful apply and the confirmation never appears.
    it('confirms an apply that set no URL', async () => {
      executeCommand.resolves('applied');

      await webviewView.receiveMessage({ command: 'apply-org-config' });

      expect(messageOfType('apply-org-config')?.applied).to.be.true;
    });

    it('confirms an apply that set a URL', async () => {
      executeCommand.callsFake(async () => {
        await vscode.workspace
          .getConfiguration('appMap')
          .update('configurationUrl', 'https://example.com/config.json');
        return 'applied';
      });

      await webviewView.receiveMessage({ command: 'apply-org-config' });

      expect(messageOfType('apply-org-config')?.applied).to.be.true;
    });

    // Nothing was applied, so nothing is confirmed — even though a configuration that was
    // already in force still is.
    it('does not confirm when the user dismisses the command', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('configurationUrl', 'https://example.com/config.json');
      executeCommand.resolves('cancelled');

      await webviewView.receiveMessage({ command: 'apply-org-config' });

      expect(messageOfType('apply-org-config')?.applied).to.be.false;
    });

    it('does not confirm when the configuration was cleared', async () => {
      executeCommand.resolves('cleared');

      await webviewView.receiveMessage({ command: 'apply-org-config' });

      expect(messageOfType('apply-org-config')?.applied).to.be.false;
    });

    it('reports a command failure to the webview', async () => {
      executeCommand.rejects(new Error('nope'));

      await webviewView.receiveMessage({ command: 'apply-org-config' });

      expect(messageOfType('apply-org-config')?.error).to.equal('nope');
    });
  });
});
