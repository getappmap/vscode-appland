import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';

import { NodeProcessService } from '../../../src/services/nodeProcessService';
import * as WorkspaceServicesModule from '../../../src/services/workspaceServices';
import MockExtensionContext from '../../mocks/mockExtensionContext';
import NodeProcessServiceInstance from '../../../src/services/nodeProcessServiceInstance';
import type * as vscode from 'vscode';

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

describe('NodeProcessService config changes', () => {
  let sinon: Sinon.SinonSandbox;
  let service: NodeProcessService;
  let enrolled: NodeProcessServiceInstance[];
  const folder = {
    uri: { fsPath: '/w' },
    name: 'w',
    index: 0,
  } as unknown as vscode.WorkspaceFolder;

  // A registry that behaves like WorkspaceServices for one folder.
  function stubRegistry(): void {
    sinon.stub(WorkspaceServicesModule, 'workspaceServices').returns({
      getServiceInstancesFromClass: () => [...enrolled],
      unenrollServiceInstance: (_folder: unknown, instance: NodeProcessServiceInstance) => {
        enrolled = enrolled.filter((i) => i !== instance);
        instance.dispose();
      },
      enrollServiceInstance: (_folder: unknown, instance: NodeProcessServiceInstance) => {
        enrolled.push(instance);
      },
    } as unknown as WorkspaceServicesModule.WorkspaceServices);
  }

  beforeEach(() => {
    sinon = Sinon.createSandbox();
    sinon.stub(NodeProcessService.outputChannel, 'appendLine');
    service = new NodeProcessService(new MockExtensionContext());
    enrolled = [];
    stubRegistry();
    // Building the real watchers needs the config manager and CLI assets; not the point here.
    sinon
      .stub(service as unknown as { createServices: () => Promise<unknown[]> }, 'createServices')
      .callsFake(() => new Promise((resolve) => setImmediate(() => resolve([]))));
    enrolled.push(new NodeProcessServiceInstance(folder, []));
  });

  afterEach(() => {
    enrolled.forEach((i) => i.dispose());
    sinon.restore();
  });

  const change = () =>
    (
      service as unknown as { handleConfigChange: (f: vscode.WorkspaceFolder) => Promise<void> }
    ).handleConfigChange(folder);

  it('replaces the folder instance with a single new one', async () => {
    const [original] = enrolled;
    await change();
    expect(enrolled).to.have.length(1);
    expect(enrolled[0]).to.not.equal(original);
  });

  it('leaves one instance after a burst of simultaneous changes', async () => {
    await Promise.all([change(), change(), change(), change(), change()]);
    expect(enrolled).to.have.length(1);
  });

  it('stops every instance the folder has, not only the first', async () => {
    enrolled.push(new NodeProcessServiceInstance(folder, []));
    enrolled.push(new NodeProcessServiceInstance(folder, []));
    const stops = enrolled.map((i) => sinon.spy(i, 'stop'));
    await change();
    stops.forEach((stop) => expect(stop.calledOnce).to.be.true);
    expect(enrolled).to.have.length(1);
  });

  it('collapses changes that arrive during a rebuild into one more rebuild', async () => {
    const createServices = (service as unknown as { createServices: Sinon.SinonStub })
      .createServices;
    const first = change();
    change();
    change();
    change();
    await first;
    // Let the queued rebuild finish.
    await change();
    // First rebuild, the one queued rebuild, and the final explicit one.
    expect(createServices.callCount).to.equal(3);
  });
});
