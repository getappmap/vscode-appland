/* eslint-disable @typescript-eslint/no-explicit-any */
import '../mock/vscode';

import { default as chai, expect } from 'chai';
import { default as chaiAsPromised } from 'chai-as-promised';
import { join } from 'path';
import Sinon from 'sinon';
import { Client } from 'jayson/promise';
import { ConfigurationRpc } from '@appland/rpc';

import RpcProcessService, { RpcProcessServiceState } from '../../../src/services/rpcProcessService';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import EventEmitter from '../mock/vscode/EventEmitter';
import { waitFor } from '../../waitFor';
import vscode from '../mock/vscode';

chai.use(chaiAsPromised);

const testModule = join(__dirname, 'support', 'mockRpc.mjs');
class MockConfigManagerInstance {
  public _onConfigChanged = new EventEmitter();
  public onConfigChanged = this._onConfigChanged.event;
  public workspaceConfigs = [{ configFolder: __dirname }];
}

describe('RpcProcessService', () => {
  let rpcService: RpcProcessService;
  let rpcServiceState: RpcProcessServiceState;
  let configManagerInstance: MockConfigManagerInstance;
  let extensionContext: MockExtensionContext;
  let rpcRequest: Sinon.SinonStub;
  let sinon: Sinon.SinonSandbox;
  const originalTestKey = process.env.APPMAP_TEST_API_KEY;

  beforeEach(async () => {
    sinon = Sinon.createSandbox();

    extensionContext = new MockExtensionContext();
    configManagerInstance = new MockConfigManagerInstance();

    rpcService = new RpcProcessService(
      extensionContext,
      [configManagerInstance] as any,
      testModule
    );
    rpcServiceState = rpcService.state;

    // Required to launch the process
    process.env.APPMAP_TEST_API_KEY = 'test-key';
  });

  afterEach(() => {
    rpcService?.dispose();
    process.env.APPMAP_TEST_API_KEY = originalTestKey;
  });

  const stubRpcConfiguration = () => {
    rpcRequest = sinon.stub();
    rpcRequest.resolves({} as any);
    const rpcClient = {
      request: rpcRequest,
    } as unknown as Client;
    rpcService.rpcConnect = () => rpcClient;
  };

  describe('create', () => {
    beforeEach(() => stubRpcConfiguration());

    it('waits for the process to start', async () => {
      await rpcServiceState.waitForStartup();
      expect(rpcService.available).to.be.true;
    });
  });

  describe('when the port changes', () => {
    beforeEach(async () => {
      stubRpcConfiguration();
      await rpcServiceState.waitForStartup();
    });

    it('restarts', async () => {
      const eventListener = sinon.fake();
      rpcService.onRpcPortChange(eventListener);

      await waitFor(`Expecting RPC port change event`, () => eventListener.calledOnce);

      const restartFn = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for restart')), 60_000);
        const disposable = rpcService.onRpcPortChange(() => {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        });
      });

      rpcServiceState.killProcess();

      await restartFn;
      await waitFor(`Expecting RPC port change event`, () => eventListener.calledTwice);
    });
  });

  describe('when AppMap configuration state changes', () => {
    describe('when configuration v2 is available', () => {
      beforeEach(() => stubRpcConfiguration());

      it('updates v2 RPC configuration', async () => {
        await rpcServiceState.waitForStartup();

        await waitFor(`Expecting RPC reconfiguration`, () => rpcRequest.callCount === 2);

        expect(rpcRequest.calledWith(ConfigurationRpc.V2.Get.Method)).to.be.true;
        expect(
          rpcRequest.calledWith(ConfigurationRpc.V2.Set.Method, {
            appmapConfigFiles: [join(__dirname, 'appmap.yml')],
            projectDirectories: [],
          })
        ).to.be.true;

        configManagerInstance._onConfigChanged.fire({});

        await waitFor(`Expecting RPC reconfiguration`, () => rpcRequest.callCount === 4);
      });
    });

    describe('when configuration v2 is not available', () => {
      it('updates v1 RPC configuration', async () => {
        rpcRequest = sinon.stub();
        rpcRequest.onFirstCall().rejects({ error: 'Method not found', code: -32601 });
        rpcRequest.onSecondCall().resolves({} as any);
        const rpcClient = {
          request: rpcRequest,
        } as unknown as Client;
        rpcService.rpcConnect = () => rpcClient;

        await rpcServiceState.waitForStartup();
        await waitFor(`Expecting RPC reconfiguration`, () => rpcRequest.callCount === 2);

        expect(rpcRequest.calledWith(ConfigurationRpc.V2.Get.Method)).to.be.true;
        expect(
          rpcRequest.calledWith(ConfigurationRpc.V1.Set.Method, {
            appmapConfigFiles: [join(__dirname, 'appmap.yml')],
          })
        ).to.be.true;
      });
    });
  });

  describe('restart()', () => {
    beforeEach(async () => {
      stubRpcConfiguration();
      await rpcServiceState.waitForStartup();
    });

    it('restarts the RPC server, keeping the port', async () => {
      const eventListener = sinon.fake();
      rpcService.onRpcPortChange(eventListener);

      await waitFor(`Expecting RPC port change event`, () => eventListener.calledOnce);

      const port = rpcService.port();
      expect(port).to.be.greaterThan(0);

      const restartFn = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout waiting for restart')), 60_000);
        const disposable = rpcService.onRpcPortChange(() => {
          clearTimeout(timeout);
          disposable.dispose();
          resolve();
        });
      });

      await rpcService.restart();

      await restartFn;
      await waitFor(`Expecting RPC port change event`, () => eventListener.calledTwice);

      expect(rpcService.port()).to.equal(port);
    });

    it('debounces the restart calls', async () => {
      const restartSpy = sinon.spy(rpcService, 'restart');

      rpcService.debounceTime = 50;

      rpcService.scheduleRestart();
      rpcService.scheduleRestart();
      rpcService.scheduleRestart();

      await waitFor(`Expecting debounced restart`, () => restartSpy.calledOnce);
    });
  });

  describe('updateSettings', () => {
    it('does not restart if no settings are changed', async () => {
      const restartSpy = sinon.spy(rpcService, 'restart');
      await rpcService.updateSettings({});
      expect(restartSpy.called).to.be.false;
    });

    it('restarts if the useCopilot setting is changed', async () => {
      const restartSpy = sinon.spy(rpcService, 'restart');
      await rpcService.updateSettings({ useCopilot: true });
      expect(restartSpy.called).to.be.true;
    });

    it('restarts if the openAIApiKey setting is changed', async () => {
      const restartSpy = sinon.spy(rpcService, 'restart');
      await rpcService.updateSettings({ openAIApiKey: 'new-key' });
      expect(restartSpy.called).to.be.true;
    });

    it('does not restart if the openAIApiKey setting is the same', async () => {
      extensionContext.secrets.store('openai.api_key', 'old-key');
      const restartSpy = sinon.spy(rpcService, 'restart');
      await rpcService.updateSettings({ openAIApiKey: 'old-key' });
      expect(restartSpy.called).to.be.false;
    });

    it('restarts if the env setting is changed', async () => {
      const restartSpy = sinon.spy(rpcService, 'restart');
      await rpcService.updateSettings({ env: { foo: 'bar' } });
      expect(restartSpy.called).to.be.true;
    });

    it('properly sets env values', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('commandLineEnvironment', { foo: 'bar', bar: 'baz' }, true);
      await rpcService.updateSettings({ env: { foo: undefined, baz: 'qux' } });
      const env = vscode.workspace.getConfiguration('appMap').get('commandLineEnvironment');
      expect(env).to.deep.equal({ bar: 'baz', baz: 'qux' });
    });
  });
});
