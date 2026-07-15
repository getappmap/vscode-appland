import '../mock/vscode';

import assert from 'assert';
import sinon from 'sinon';
import * as vscode from 'vscode';
import { WorkspaceService, WorkspaceServiceInstance } from '../../../src/services/workspaceService';
import { initializeWorkspaceServices } from '../../../src/services/workspaceServices';

class TestServiceInstance implements WorkspaceServiceInstance {
  public disposed = false;

  constructor(public readonly folder: vscode.WorkspaceFolder) {}

  dispose() {
    this.disposed = true;
  }
}
class TestService implements WorkspaceService<TestServiceInstance> {
  public static readonly serviceId = 'TestService';

  create(folder: vscode.WorkspaceFolder) {
    return new TestServiceInstance(folder);
  }
}

describe('WorkspaceService', () => {
  // A single workspace folder so enroll() creates exactly one service instance.
  beforeEach(() =>
    sinon
      .stub(vscode.workspace, 'workspaceFolders')
      .value([{ uri: vscode.Uri.file('/test'), name: 'test', index: 0 }])
  );
  afterEach(() => sinon.restore());

  it('services can be unenrolled', async () => {
    const services = initializeWorkspaceServices();
    await services.enroll(new TestService());

    const service = services.getService(TestService) as TestService;
    assert(service);

    const instances = services.getServiceInstances(service);
    assert(instances.length === 1);

    const instance = instances[0] as TestServiceInstance;
    assert(instance.disposed === false);

    services.unenroll(service);
    assert(instance.disposed);
    assert(services.getServiceInstances(service).length === 0);
    assert(services.getService(TestService) === undefined);
  });
});
