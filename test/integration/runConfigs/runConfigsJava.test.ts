// @project project-java

import * as vscode from 'vscode';

import assert from 'assert';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';
import { SinonSandbox, createSandbox, SinonStub } from 'sinon';

import { RunConfigServiceInstance } from '../../../src/services/runConfigService';
import ExtensionState from '../../../src/configuration/extensionState';
import { ExpectedLaunchConfig, ExpectedTestConfig, FakeConfig } from './util';
import { ProjectJava, initializeWorkspace, waitFor, waitForExtension } from '../util';

describe('run config service in a Java Project', () => {
  let sinon: SinonSandbox;
  let runConfigServiceInstance: RunConfigServiceInstance;
  let state: ExtensionState;
  let getConfigStub: SinonStub;

  before(async () => {
    sinon = createSandbox();
    sinon.stub(os, 'homedir').returns(ProjectJava);

    // This needs to be faked because the Test Runner for Java extension is not installed during testing
    // and VS Code will throw an error when attempting to update an unregistered config ("java.test.config")
    getConfigStub = sinon.stub(vscode.workspace, 'getConfiguration');
    getConfigStub.withArgs('java.test').returns(FakeConfig);
    getConfigStub.callThrough();

    const { workspaceServices, runConfigService, extensionState } = await waitForExtension();
    state = extensionState;

    const runConfigServiceInstances = workspaceServices.getServiceInstances(runConfigService);
    assert.strictEqual(runConfigServiceInstances.length, 1);
    runConfigServiceInstance = runConfigServiceInstances[0];

    // Pretend that the Test Runner for Java extension is installed
    sinon.stub(runConfigServiceInstance, 'hasJavaTestExtension').returns(true);
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
});
