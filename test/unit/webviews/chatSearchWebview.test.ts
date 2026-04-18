import '../mock/vscode';

import { expect } from 'chai';
import sinon from 'sinon';

import CommandRegistry from '../../../src/commands/commandRegistry';
import ExtensionState from '../../../src/configuration/extensionState';
import RpcProcessService from '../../../src/services/rpcProcessService';
import ChatSearchWebview from '../../../src/webviews/chatSearchWebview';

import MockAppMapCollection from '../../mocks/mockAppMapCollection';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import EventEmitter from '../mock/vscode/EventEmitter';
import { WebviewPanels } from '../mock/vscode/window';

function createMockRpcService(
  sandbox: sinon.SinonSandbox
): sinon.SinonStubbedInstance<RpcProcessService> {
  const rpcService = sandbox.createStubInstance(RpcProcessService);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- readonly property
  (rpcService as any).onRpcPortChange = new EventEmitter().event;
  sandbox.stub(rpcService, 'onBeforeRestart').get(() => new EventEmitter().event);
  rpcService.port.returns(8080);

  return rpcService;
}

describe('ChatSearchWebview', () => {
  let sandbox: sinon.SinonSandbox;
  let context: MockExtensionContext;
  let extensionState: sinon.SinonStubbedInstance<ExtensionState>;
  let appmaps: MockAppMapCollection;
  let rpcService: sinon.SinonStubbedInstance<RpcProcessService>;
  let chatSearchWebview: ChatSearchWebview;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    context = new MockExtensionContext();
    CommandRegistry.setContext(context);
    extensionState = sandbox.createStubInstance(ExtensionState);

    appmaps = new MockAppMapCollection();
    rpcService = createMockRpcService(sandbox);

    chatSearchWebview = ChatSearchWebview.register(
      context,
      extensionState as unknown as ExtensionState,
      appmaps,
      rpcService as unknown as RpcProcessService
    );

    // Clear out any previous mock panels
    WebviewPanels.length = 0;
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should process change-model-config for non-secret env variables', async () => {
    await chatSearchWebview.explain();

    // The panel should have been created and added to the mocked WebviewPanels array
    expect(WebviewPanels).to.have.lengthOf(1);
    const panel = WebviewPanels[0];

    // Simulate sending a message from the webview
    panel.receiveMessage({
      command: 'change-model-config',
      key: 'MODEL_NAME',
      value: 'gpt-4',
      secret: false,
    });

    expect(rpcService.updateEnv.calledOnce).to.be.true;
    expect(rpcService.updateEnv.firstCall.args[0]).to.deep.equal({
      env: { MODEL_NAME: 'gpt-4' },
    });
  });

  it('should process change-model-config for secret env variables', async () => {
    await chatSearchWebview.explain();

    expect(WebviewPanels).to.have.lengthOf(1);
    const panel = WebviewPanels[0];

    panel.receiveMessage({
      command: 'change-model-config',
      key: 'API_KEY',
      value: 'secret_token',
      secret: true,
    });

    expect(rpcService.updateEnv.calledOnce).to.be.true;
    expect(rpcService.updateEnv.firstCall.args[0]).to.deep.equal({
      secretEnv: { API_KEY: 'secret_token' },
    });
  });
});
