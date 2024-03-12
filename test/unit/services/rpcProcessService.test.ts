import '../mock/vscode';
import { expect } from 'chai';
import { join } from 'path';
import RpcProcessService from '../../../src/services/rpcProcessService';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import EventEmitter from '../mock/vscode/EventEmitter';
import { AppmapConfigManagerInstance } from '../../../src/services/appmapConfigManager';
import Sinon from 'sinon';
import { nextTick } from 'process';

const testModule = join(__dirname, 'support', 'mockRpc.mjs');
class MockConfigManagerInstance {
  public _onConfigChanged = new EventEmitter();
  public onConfigChanged = this._onConfigChanged.event;
  public workspaceConfigs = [{ configFolder: __dirname }];
}

describe('RpcProcessWatcher', () => {
  let rpcService: RpcProcessService;
  let configManagerInstance: AppmapConfigManagerInstance;
  const originalTestKey = process.env.APPMAP_TEST_API_KEY;

  beforeEach(() => {
    const extensionContext = new MockExtensionContext();
    configManagerInstance =
      new MockConfigManagerInstance() as unknown as AppmapConfigManagerInstance;

    process.env.APPMAP_TEST_API_KEY = 'test-key';

    // The constructor is private, so we need to cast to any to create an instance.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpcService = new (RpcProcessService as any)(
      extensionContext,
      [configManagerInstance],
      testModule
    );
  });

  afterEach(() => {
    rpcService.dispose();
    process.env.APPMAP_TEST_API_KEY = originalTestKey;
  });

  describe('with no process running', () => {
    it('states the service is not available', () => {
      expect(rpcService.available).to.be.false;
    });

    it('starts the process when the port is requested', async () => {
      const port = await rpcService.port();
      expect(port).to.be.equal(1234);
    });
  });

  describe('with a process running', () => {
    // Requesting the port will start the process
    beforeEach(() => rpcService.port());

    it('states the service is available', () => {
      expect(rpcService.available).to.be.true;
    });

    it('rebuilds the process when the config changes', async () => {
      const eventListener = Sinon.fake();
      rpcService.onRpcPortChange(eventListener);

      expect(rpcService.available).to.be.true;

      // Private method access
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (configManagerInstance as any)._onConfigChanged.fire();
      expect(rpcService.available).to.be.false;

      nextTick(() => {
        expect(eventListener.calledOnce).to.be.true;
        expect(rpcService.available).to.be.true;
      });
    });
  });
});
