import { expect } from 'chai';
import sinon from 'sinon';
import '../mock/vscode';
import * as vscode from 'vscode';
import * as workspaceServices from '../../../src/services/workspaceServices';
import selectIndexProcess, { ReasonCode } from '../../../src/lib/selectIndexProcess';
import { ProcessId } from '../../../src/services/processWatcher';
import IndexProcessWatcher from '../../../src/services/indexProcessWatcher';

describe('selectIndexProcess', () => {
  let sandbox: sinon.SinonSandbox;
  let processes: IndexProcessWatcher[];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    processes = [];
    const stubService = sandbox.stub();
    sandbox.stub(workspaceServices, 'workspaceServices').returns({
      getService: sandbox.stub().returns(stubService),
      getServiceInstances: (service: unknown) => {
        expect(service).to.eq(stubService);
        return [{ processes }];
      },
    } as unknown as workspaceServices.WorkspaceServices);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('when there is no index process', () => {
    it('returns undefined', async () => {
      const result = await selectIndexProcess();
      expect(result).to.eq(ReasonCode.NoIndexProcessWatchers);
    });
  });
  describe('when there is one index process', () => {
    describe('but the RPC port is not available', () => {
      beforeEach(() => {
        processes = [
          {
            id: ProcessId.Index,
            isRpcAvailable: sandbox.stub().returns(false),
          } as unknown as IndexProcessWatcher,
        ];
      });

      it('returns undefined', async () => {
        const result = await selectIndexProcess();
        expect(result).to.eq(ReasonCode.NoReadyIndexProcessWatchers);
      });
    });
    describe('and the RPC port is available', () => {
      beforeEach(() => {
        processes = [
          {
            id: ProcessId.Index,
            isRpcAvailable: sandbox.stub().returns(true),
            configFolder: './the-project',
            rpcPort: 1234,
          } as unknown as IndexProcessWatcher,
        ];
      });

      it('returns the process', async () => {
        const result = await selectIndexProcess();
        expect(result).to.deep.equal({
          configFolder: './the-project',
          rpcPort: 1234,
        });
      });
    });
  });
  describe('when there are multiple index processes', () => {
    beforeEach(() => {
      processes = [
        {
          id: ProcessId.Index,
          isRpcAvailable: sandbox.stub().returns(true),
          configFolder: './project-a',
          rpcPort: 1,
        } as unknown as IndexProcessWatcher,
        {
          id: ProcessId.Index,
          isRpcAvailable: sandbox.stub().returns(true),
          configFolder: './project-b',
          rpcPort: 2,
        } as unknown as IndexProcessWatcher,
      ];
    });

    it('prompts the user to choose', async () => {
      const quickPick = sandbox.stub(vscode.window, 'showQuickPick');
      quickPick.onFirstCall().resolves({
        label: './project-a',
        watcher: processes[0],
      } as unknown as vscode.QuickPickItem & { watcher: IndexProcessWatcher });

      const result = await selectIndexProcess();
      expect(result).to.deep.equal({
        configFolder: './project-a',
        rpcPort: 1,
      });
    });
  });
});
