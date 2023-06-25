import * as vscode from 'vscode';

import assert from 'assert';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { SinonSandbox, createSandbox, SinonStub, SinonSpy } from 'sinon';

import { RunConfigServiceInstance } from '../../../src/services/runConfigService';
import ExtensionState from '../../../src/configuration/extensionState';
import { FakeConfig } from './util';
import { ProjectA, initializeWorkspace, waitForExtension } from '../util';

describe('run config service in a Ruby project', () => {
  let sinon: SinonSandbox;
  let runConfigServiceInstance: RunConfigServiceInstance;
  let state: ExtensionState;
  let fakeConfigGetSpy: SinonSpy;
  let fakeConfigUpdateSpy: SinonSpy;
  let getConfigStub: SinonStub;

  // NOTE: This is a before 'all' because each of the tests is designed to run in sequence in the same workspace instance.
  before(async () => {
    await initializeWorkspace();

    sinon = createSandbox();
    sinon.stub(os, 'homedir').returns(ProjectA);

    fakeConfigGetSpy = sinon.spy(FakeConfig, 'get');
    fakeConfigUpdateSpy = sinon.spy(FakeConfig, 'update');
    getConfigStub = sinon.stub(vscode.workspace, 'getConfiguration');
    getConfigStub.withArgs('java.test').returns(FakeConfig);
    getConfigStub.withArgs('launch').returns(FakeConfig);
    getConfigStub.callThrough();

    const { workspaceServices, runConfigService, extensionState } = await waitForExtension();
    state = extensionState;

    const runConfigServiceInstances = workspaceServices.getServiceInstances(runConfigService);
    assert.strictEqual(runConfigServiceInstances.length, 1);
    runConfigServiceInstance = runConfigServiceInstances[0];
  });

  after(async () => {
    sinon.restore();
    await initializeWorkspace();
  });

  it('does not create a new run configuration or test configuration', async () => {
    assert(!existsSync(path.join(ProjectA, '.vscode', 'launch.json')));
    assert.deepStrictEqual(fakeConfigGetSpy.callCount, 0);
    assert.deepStrictEqual(fakeConfigUpdateSpy.callCount, 0);
  });

  it('saves that the launch config was not created', () => {
    assert(!state.getUpdatedLaunchConfig(runConfigServiceInstance.folder));
  });

  it('saves that the test config was not created', () => {
    assert(!state.getUpdatedTestConfig(runConfigServiceInstance.folder));
  });
});
