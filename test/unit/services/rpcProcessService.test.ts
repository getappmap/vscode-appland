/* eslint-disable @typescript-eslint/no-explicit-any */
import '../mock/vscode';
import { default as chai, expect } from 'chai';
import { default as chaiAsPromised } from 'chai-as-promised';
import { join } from 'path';
import RpcProcessService from '../../../src/services/rpcProcessService';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import EventEmitter from '../mock/vscode/EventEmitter';
import * as NodeDependencyProcess from '../../../src/services/nodeDependencyProcess';
import Sinon from 'sinon';

chai.use(chaiAsPromised);

const testModule = join(__dirname, 'support', 'mockRpc.mjs');
class MockConfigManagerInstance {
  public _onConfigChanged = new EventEmitter();
  public onConfigChanged = this._onConfigChanged.event;
  public workspaceConfigs = [{ configFolder: __dirname }];
}

describe('RpcProcessWatcher', () => {
  let rpcService: RpcProcessService;
  let configManagerInstance: MockConfigManagerInstance;
  let extensionContext: MockExtensionContext;
  const originalTestKey = process.env.APPMAP_TEST_API_KEY;

  beforeEach(() => {
    Sinon.restore();
    extensionContext = new MockExtensionContext();
    configManagerInstance = new MockConfigManagerInstance();

    // Required to launch the process
    process.env.APPMAP_TEST_API_KEY = 'test-key';
  });

  afterEach(() => {
    rpcService?.dispose();
    process.env.APPMAP_TEST_API_KEY = originalTestKey;
  });

  describe('create', () => {
    it('creates a new instance and waits for it to start', async () => {
      const getModulePath = Sinon.stub(NodeDependencyProcess, 'getModulePath').resolves(testModule);

      rpcService = await RpcProcessService.create(extensionContext, [configManagerInstance] as any);

      expect(getModulePath.calledOnce).to.be.true;
      expect(rpcService.available).to.be.true;
    });
  });

  describe('with a module path', () => {
    beforeEach(() => {
      // The constructor is private, so we need to cast to any to create an instance.
      rpcService = new (RpcProcessService as any)(
        extensionContext,
        [configManagerInstance],
        testModule
      );
    });

    it('waits for the process to start', async () => {
      await (rpcService as any).waitForStartup();
      expect(rpcService.available).to.be.true;
    });

    it('notifies when the port changes', async () => {
      const eventListener = Sinon.fake();
      rpcService.onRpcPortChange(eventListener);

      await (rpcService as any).waitForStartup();
      expect(eventListener.calledOnce).to.be.true;

      (rpcService as any).processWatcher?.process.kill();

      const restarted = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for restart')), 60_000);
        const disposable = rpcService.onRpcPortChange(() => {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        });
      });

      // Note that the port is hardcoded in the mockRpc.mjs file.
      // The process will restart on the same port, so we can't assert the port number.
      return expect(restarted).to.be.fulfilled;
    });

    it('calls an RPC method when the configuration changes', async () => {
      await (rpcService as any).waitForStartup();
      const spy = Sinon.fake();
      (rpcService as any).rpcClient = {
        request: spy,
      } as any;

      configManagerInstance._onConfigChanged.fire({});
      expect(spy.calledOnce).to.be.true;
    });
  });

  describe('without a module path', () => {
    beforeEach(() => {
      // The constructor is private, so we need to cast to any to create an instance.

      rpcService = new (RpcProcessService as any)(
        extensionContext,
        [configManagerInstance],
        undefined
      );
    });

    it('cannot be started', () => {
      return expect((rpcService as any).waitForStartup()).to.be.rejectedWith(
        'RPC process not available'
      );
    });
  });
});
