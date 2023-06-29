// @project project-java

import * as vscode from 'vscode';

import assert from 'assert';
import path from 'path';
import { SinonSandbox, createSandbox, SinonStub, SinonSpy } from 'sinon';

import { RunConfigServiceInstance } from '../../../src/services/runConfigService';
import ExtensionState from '../../../src/configuration/extensionState';
import { ProjectJava, initializeWorkspace } from '../util';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';

class MockExtensionState {
  updatedTestConfig = false;
  getUpdatedTestConfig(): boolean {
    return this.updatedTestConfig;
  }
  setUpdatedTestConfig(_workspaceFolder: vscode.WorkspaceFolder, value: boolean): void {
    this.updatedTestConfig = value;
  }
  getUpdatedLaunchConfig(): boolean {
    return true;
  }
}

class MockConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data = [] as any;
  get() {
    return this.data;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(_section: string, value: any) {
    this.data = value;
  }
}

const fakeProjectState = {
  onStateChange() {
    // not implemented
  },
  metadata: {
    language: {
      name: 'Java',
    },
  },
} as unknown;

describe('test configs in a Java Project', () => {
  let sinon: SinonSandbox;
  let runConfigServiceInstance: RunConfigServiceInstance;
  let getConfigStub: SinonStub;
  let extensionState: ExtensionState;
  let fakeConfigGetSpy: SinonSpy;
  let fakeConfigUpdateSpy: SinonSpy;

  const fakeConfig = new MockConfig();

  beforeEach(async () => {
    sinon = createSandbox();

    fakeConfigGetSpy = sinon.spy(fakeConfig, 'get');
    fakeConfigUpdateSpy = sinon.spy(fakeConfig, 'update');

    const workspaceFolder: vscode.WorkspaceFolder = {
      name: path.basename(ProjectJava),
      uri: vscode.Uri.file(ProjectJava),
      index: -1,
    };
    const mockExtensionState = new MockExtensionState() as unknown;
    extensionState = mockExtensionState as ExtensionState;
    runConfigServiceInstance = new RunConfigServiceInstance(
      workspaceFolder,
      fakeProjectState as ProjectStateServiceInstance,
      extensionState
    );

    // Test Runner for Java extension is installed
    sinon.stub(runConfigServiceInstance, 'hasJavaTestExtension').returns(true);
    // Test config hasn't already been created
    sinon.stub(runConfigServiceInstance, 'hasPreviouslyUpdatedTestConfig').returns(false);

    // This is tested in runConfigsJava.test.ts so we can ignore it here
    sinon.stub(runConfigServiceInstance, 'updateLaunchConfig');

    // This needs to be faked because the Test Runner for Java extension is not installed during testing
    // and VS Code will throw an error when attempting to update an unregistered config ("java.test.config")
    getConfigStub = sinon.stub(vscode.workspace, 'getConfiguration');
    getConfigStub.withArgs('java.test').returns(fakeConfig);
    getConfigStub.callThrough();
  });

  afterEach(async () => {
    sinon.restore();
    await initializeWorkspace();
    fakeConfig.data = [];
  });

  it('correctly generates a test config', async () => {
    await runConfigServiceInstance.updateConfigs();

    assert.deepStrictEqual(fakeConfigGetSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigUpdateSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigGetSpy.getCall(0).args[0], 'config');
    assert.deepStrictEqual(fakeConfigUpdateSpy.getCall(0).args, [
      'config',
      [runConfigServiceInstance.appmapTestConfig],
    ]);
    assert.deepStrictEqual(fakeConfig.get(), [runConfigServiceInstance.appmapTestConfig]);
  });

  it('correctly generates a test config when another test config is already present', async () => {
    const preexistingTestConfig = { name: 'Test' };
    fakeConfig.data = [preexistingTestConfig];

    await runConfigServiceInstance.updateConfigs();

    assert.deepStrictEqual(fakeConfigGetSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigUpdateSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigGetSpy.getCall(0).args[0], 'config');
    assert.deepStrictEqual(fakeConfigUpdateSpy.getCall(0).args, [
      'config',
      [preexistingTestConfig, runConfigServiceInstance.appmapTestConfig],
    ]);
    assert.deepStrictEqual(fakeConfig.get(), [
      preexistingTestConfig,
      runConfigServiceInstance.appmapTestConfig,
    ]);
  });

  it('does not add a test config if one was previously generated', async () => {
    fakeConfig.data = [runConfigServiceInstance.appmapTestConfig];
    extensionState.setUpdatedTestConfig({} as vscode.WorkspaceFolder, true);

    await runConfigServiceInstance.updateConfigs();

    assert.deepStrictEqual(fakeConfigGetSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigUpdateSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigGetSpy.getCall(0).args[0], 'config');
    assert.deepStrictEqual(fakeConfigUpdateSpy.getCall(0).args, [
      'config',
      [runConfigServiceInstance.appmapTestConfig],
    ]);
    assert.deepStrictEqual(fakeConfig.get(), [runConfigServiceInstance.appmapTestConfig]);
  });

  it('updates a previously added test config if it does not have the output dir vmArg', async () => {
    const incompleteAppmapConfig = {
      name: 'Test with AppMap',
      vmArgs: ['-javaagent:${userHome}/.appmap/lib/java/appmap.jar'],
    };
    fakeConfig.data = [incompleteAppmapConfig];
    extensionState.setUpdatedTestConfig({} as vscode.WorkspaceFolder, true);

    await runConfigServiceInstance.updateConfigs();

    assert.deepStrictEqual(fakeConfigGetSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigUpdateSpy.callCount, 1);
    assert.deepStrictEqual(fakeConfigGetSpy.getCall(0).args[0], 'config');
    assert.deepStrictEqual(fakeConfigUpdateSpy.getCall(0).args, [
      'config',
      [runConfigServiceInstance.appmapTestConfig],
    ]);
    assert.deepStrictEqual(fakeConfig.get(), [runConfigServiceInstance.appmapTestConfig]);
  });
});
