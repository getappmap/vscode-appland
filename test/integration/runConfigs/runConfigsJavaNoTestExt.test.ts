// @project project-java

import * as vscode from 'vscode';

import assert from 'assert';
import { existsSync } from 'fs';
import path from 'path';
import { SinonSandbox, createSandbox, SinonStub, SinonSpy } from 'sinon';

import { RunConfigServiceInstance } from '../../../src/services/runConfigService';
import ExtensionState from '../../../src/configuration/extensionState';
import { ExpectedLaunchConfig, ExpectedTestConfig, FakeConfig } from './util';
import { ProjectJava, initializeWorkspace, waitFor, waitForExtension } from '../util';

describe('run config service in a Java Project without the Test Runner for Java extension', () => {
  let sinon: SinonSandbox;
  let runConfigServiceInstance: RunConfigServiceInstance;
  let state: ExtensionState;
  let fakeConfigUpdateSpy: SinonSpy;
  let getConfigStub: SinonStub;

  // NOTE: This is a before 'all' because each of the tests is designed to run in sequence in the same workspace instance.
  before(async () => {
    await initializeWorkspace();

    sinon = createSandbox();

    fakeConfigUpdateSpy = sinon.spy(FakeConfig, 'update');
    getConfigStub = sinon.stub(vscode.workspace, 'getConfiguration');
    getConfigStub.withArgs('java.test').returns(FakeConfig);
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

  it('correctly generates the expected configurations', () => {
    assert.deepStrictEqual(runConfigServiceInstance.appmapLaunchConfig, ExpectedLaunchConfig);
    assert.deepStrictEqual(runConfigServiceInstance.appmapTestConfig, ExpectedTestConfig);
  });

  it('creates a new run configuration', async () => {
    await waitFor('launch.json to be created', () =>
      existsSync(path.join(ProjectJava, '.vscode', 'launch.json'))
    );

    let configs;
    await waitFor('launch config to be created', () => {
      const config = vscode.workspace.getConfiguration('launch');
      configs = config.get('configurations');
      return configs.length > 0;
    });

    assert.deepStrictEqual(configs, [runConfigServiceInstance.appmapLaunchConfig]);
  });

  it('saves that the launch config was created', () => {
    assert(state.getUpdatedLaunchConfig(runConfigServiceInstance.folder));
  });

  it('does not create a new test configuration', () => {
    assert.deepStrictEqual(fakeConfigUpdateSpy.callCount, 0);
  });

  it('saves that the test config was not created', () => {
    assert(!state.getUpdatedTestConfig(runConfigServiceInstance.folder));
  });
});
