import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';

import { NodeProcessService } from '../../../src/services/nodeProcessService';
import * as WorkspaceServicesModule from '../../../src/services/workspaceServices';
import MockExtensionContext from '../../mocks/mockExtensionContext';

describe('NodeProcessService', () => {
  let sinon: Sinon.SinonSandbox;
  let service: NodeProcessService;
  let appendLine: Sinon.SinonStub;

  beforeEach(() => {
    sinon = Sinon.createSandbox();
    service = new NodeProcessService(new MockExtensionContext());
    appendLine = sinon.stub(NodeProcessService.outputChannel, 'appendLine');
  });

  afterEach(() => sinon.restore());

  describe('restartAll', () => {
    function stubInstances(instances: { restart: Sinon.SinonStub }[]): void {
      sinon.stub(WorkspaceServicesModule, 'workspaceServices').returns({
        getServiceInstancesFromClass: sinon.stub().returns(instances),
      } as unknown as WorkspaceServicesModule.WorkspaceServices);
    }

    it('restarts every enrolled instance with the given reason', async () => {
      const a = { restart: sinon.stub().resolves() };
      const b = { restart: sinon.stub().resolves() };
      stubInstances([a, b]);

      await service.restartAll('test reason');

      expect(a.restart.calledOnceWith('test reason')).to.be.true;
      expect(b.restart.calledOnceWith('test reason')).to.be.true;
    });

    it('logs a failed restart instead of rejecting, and still restarts the others', async () => {
      const ok = { restart: sinon.stub().resolves() };
      const bad = { restart: sinon.stub().rejects(new Error('boom')) };
      stubInstances([bad, ok]);

      // Must not reject even though one instance fails.
      await service.restartAll('test reason');

      expect(ok.restart.calledOnce, 'sibling instance still restarted').to.be.true;
      expect(bad.restart.calledOnce).to.be.true;

      const loggedFailure = appendLine
        .getCalls()
        .some((call) => /Failed to restart AppMap service.*boom/.test(call.args[0] as string));
      expect(loggedFailure, 'failure was written to the output channel').to.be.true;
    });

    it('is a no-op when no instances are enrolled', async () => {
      stubInstances([]);
      await service.restartAll('test reason');
      // Only the "Restarting AppMap services" line, no failures.
      const failures = appendLine
        .getCalls()
        .filter((call) => /Failed to restart/.test(call.args[0] as string));
      expect(failures).to.be.empty;
    });
  });
});
