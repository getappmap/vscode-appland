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
import { Configuration } from '../mock/vscode/workspace';
import { getSecretEnv } from '../../../src/services/navieConfigurationService';
import { setCustomerId } from '../../../src/configuration/customerId';

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

  describe('on unexpected process exit', () => {
    beforeEach(async () => {
      stubRpcConfiguration();
      await rpcServiceState.waitForStartup();
    });

    it('recovers and restarts the RPC server', async () => {
      const eventListener = sinon.fake();
      rpcService.onRpcPortChange(eventListener);

      await waitFor(`Expecting RPC port change event`, () => eventListener.calledOnce);

      const port = rpcService.port();
      expect(port).to.be.greaterThan(0);

      const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

      try {
        await rpcServiceState.killProcess();

        // Now that the 'exit' event has been handled and the ProcessWatcher's 2000ms
        // retry timeout has been scheduled (using the fake timer), we fast-forward
        // the clock to instantly trigger the restart.
        await clock.tickAsync(2500);
      } finally {
        // Restore real timers immediately so that waitFor and other async operations
        // don't get stuck waiting for fake time to advance.
        clock.restore();
      }

      await waitFor(`Expecting RPC port change event`, () => eventListener.calledTwice);
      expect(rpcService.port()).to.equal(port);
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

  // Navie's backend should only run for an activated extension. Anything else leaves a server
  // listening for a user who has not signed in and is not entitled.
  describe('when the extension is neither signed in nor entitled', () => {
    beforeEach(() => {
      stubRpcConfiguration();
      delete process.env.APPMAP_TEST_API_KEY;
    });

    it('does not start the RPC server', async () => {
      await rpcServiceState.waitForStartup();

      expect(rpcService.available).to.be.false;
      expect(rpcService.port()).to.be.undefined;
    });

    it('does not start it on restart either', async () => {
      await rpcService.restart();

      expect(rpcService.available).to.be.false;
    });

    it('starts once a customer ID entitles the installation', async () => {
      await rpcServiceState.waitForStartup();
      expect(rpcService.available).to.be.false;

      await setCustomerId(extensionContext, 'acme-corp', 'orgConfig');
      await rpcService.restart();

      await waitFor('RPC server to become available', () => rpcService.available);
    });

    it('starts once the user signs in', async () => {
      await rpcServiceState.waitForStartup();
      expect(rpcService.available).to.be.false;

      process.env.APPMAP_TEST_API_KEY = 'test-key';
      await rpcService.restart();

      await waitFor('RPC server to become available', () => rpcService.available);
    });
  });

  describe('when authentication is lost while running', () => {
    beforeEach(async () => {
      stubRpcConfiguration();
      await rpcServiceState.waitForStartup();
      await waitFor('RPC server to become available', () => rpcService.available);
    });

    it('stops the RPC server', async () => {
      delete process.env.APPMAP_TEST_API_KEY;

      await rpcService.restart();

      expect(rpcService.available).to.be.false;
    });

    // A stale port sends callers to a dead socket, where they hang instead of failing.
    it('reports no port once the server has stopped', async () => {
      expect(rpcService.port()).to.be.greaterThan(0);
      delete process.env.APPMAP_TEST_API_KEY;

      await rpcService.restart();

      expect(rpcService.port()).to.be.undefined;
    });
  });

  describe('updateEnv', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('does nothing if no settings are changed', async () => {
      const updateSpy = sinon.spy(Configuration.prototype, 'update');
      const restartSpy = sinon.spy(rpcService, 'debouncedRestart');
      await rpcService.updateEnv({});
      expect(restartSpy.called).to.be.false;
      expect(updateSpy.called).to.be.false;
    });

    it('deletes empty env keys', async () => {
      const getEnv = () =>
        vscode.workspace.getConfiguration('appMap').get('commandLineEnvironment');

      await rpcService.updateEnv({ env: { foo: 'bar', baz: 'qux' } });
      expect(getEnv()).to.deep.equal({ foo: 'bar', baz: 'qux' });

      await rpcService.updateEnv({ env: { foo: undefined, baz: '' } });
      expect(getEnv()).to.deep.equal({});
    });

    it('updates the secret env if the secretEnv setting is changed', async () => {
      const restartSpy = sinon.spy(rpcService, 'debouncedRestart');
      await rpcService.updateEnv({ secretEnv: { foo: 'bar' } });
      expect(await getSecretEnv(extensionContext)).to.be.deep.equal({ foo: 'bar' });
      expect(restartSpy.called).to.be.true;
    });

    it('updates `commandLineEnvironment` if the env setting is changed', async () => {
      const updateSpy = sinon.spy(Configuration.prototype, 'update');
      await rpcService.updateEnv({ env: { foo: 'bar' } });
      expect(updateSpy.calledWith('commandLineEnvironment', { foo: 'bar' })).to.be.true;
    });

    it('properly sets env values', async () => {
      vscode.workspace
        .getConfiguration('appMap')
        .update('commandLineEnvironment', { foo: 'bar', bar: 'baz' }, true);
      await rpcService.updateEnv({ env: { foo: undefined, baz: 'qux' } });
      const env = vscode.workspace.getConfiguration('appMap').get('commandLineEnvironment');
      expect(env).to.deep.equal({ bar: 'baz', baz: 'qux' });
    });
  });
});
