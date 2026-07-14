import '../mock/vscode';

import { expect } from 'chai';
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
