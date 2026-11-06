import '../mock/vscode';

import { expect } from 'chai';
import Sinon from 'sinon';
import * as vscode from 'vscode';

import { WorkspaceServices } from '../../../src/services/workspaceServices';
import type { WorkspaceServiceInstance } from '../../../src/services/workspaceService';

class FakeService {
  static serviceId = 'FakeService';
  create() {
    return { folder: {} as vscode.WorkspaceFolder, dispose: () => undefined };
  }
}

class OtherService {
  static serviceId = 'OtherService';
  create() {
    return { folder: {} as vscode.WorkspaceFolder, dispose: () => undefined };
  }
}

describe('WorkspaceServices.getServiceInstancesFromClass', () => {
  let services: WorkspaceServices;
  let service: FakeService;
  const folder = { uri: vscode.Uri.file('/project'), name: 'project', index: 0 };

  function instance(): WorkspaceServiceInstance {
    return { folder, dispose: () => undefined };
  }

  beforeEach(async () => {
    services = new WorkspaceServices();
    service = new FakeService();
    // Registers the service; no folders are open in the mock, so no instances
    // are created by enroll() itself.
    await services.enroll(service as never);
  });

  it('returns all instances registered for the class', () => {
    const [a, b] = [instance(), instance()];
    services.enrollServiceInstance(folder, a, service as never);
    services.enrollServiceInstance(folder, b, service as never);

    const result = services.getServiceInstancesFromClass(FakeService as never);
    expect(result).to.have.members([a, b]);
  });

  it('returns an empty array when the class was never enrolled', () => {
    expect(services.getServiceInstancesFromClass(OtherService as never)).to.deep.equal([]);
  });
});

describe('WorkspaceServices folder removal', () => {
  let sinon: Sinon.SinonSandbox;
  let services: WorkspaceServices;
  let changeFolders: (event: {
    added?: vscode.WorkspaceFolder[];
    removed?: vscode.WorkspaceFolder[];
  }) => void;
  // Each create() waits until the test resolves it.
  let pending: Array<() => void>;
  let disposed: WorkspaceServiceInstance[];

  const newFolder = () => ({ uri: vscode.Uri.file('/project'), name: 'project', index: 0 });
  let folder: vscode.WorkspaceFolder;

  class SlowService {
    static serviceId = 'SlowService';
    create(f: vscode.WorkspaceFolder): Promise<WorkspaceServiceInstance> {
      const instance: WorkspaceServiceInstance = {
        folder: f,
        dispose: () => void disposed.push(instance),
      };
      return new Promise((resolve) => pending.push(() => resolve(instance)));
    }
  }
  let service: SlowService;

  // Let a resolved create() reach enrollServiceInstance().
  const tick = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(async () => {
    sinon = Sinon.createSandbox();
    sinon.stub(vscode.workspace, 'onDidChangeWorkspaceFolders').callsFake((listener) => {
      changeFolders = ({ added = [], removed = [] }) => listener({ added, removed });
      return { dispose: sinon.stub() };
    });
    pending = [];
    disposed = [];
    folder = newFolder();
    services = new WorkspaceServices();
    service = new SlowService();
    await services.enroll(service as never);
  });

  afterEach(() => sinon.restore());

  const instances = (f?: vscode.WorkspaceFolder) =>
    services.getServiceInstancesFromClass(SlowService as never, f);

  it('disposes and forgets the instances of a removed folder', async () => {
    changeFolders({ added: [folder] });
    pending.shift()?.();
    await tick();
    const [instance] = instances(folder);
    expect(instance).to.exist;

    changeFolders({ removed: [folder] });

    expect(disposed).to.deep.equal([instance]);
    expect(instances()).to.be.empty;
  });

  it('disposes an instance created for a folder removed in the meantime', async () => {
    changeFolders({ added: [folder] });
    changeFolders({ removed: [folder] });
    pending.shift()?.();
    await tick();

    expect(instances()).to.be.empty;
    expect(disposed).to.have.length(1);
  });

  it('serves the folder again once it is added back', async () => {
    changeFolders({ added: [folder] });
    changeFolders({ removed: [folder] });
    const readded = newFolder();
    changeFolders({ added: [readded] });

    // The create() for the folder as first added finishes late, after the one for its return.
    const [stale, fresh] = pending;
    fresh();
    stale();
    await tick();

    expect(instances()).to.have.length(1);
    expect(instances(readded)).to.have.length(1);
    expect(disposed).to.have.length(1);
  });
});
