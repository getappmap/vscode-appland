import { default as chai, expect } from 'chai';
import { default as chaiFs } from 'chai-fs';
import MockVSCode from '../mock/vscode';
import { URI } from 'vscode-uri';
import { RunConfigServiceInstance } from '../../../src/services/runConfigService';
import path from 'path';
import { tmpdir } from 'os';
import type { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import type ExtensionState from '../../../src/configuration/extensionState';
import Sinon from 'sinon';
import sinonChai from 'sinon-chai';

chai.use(chaiFs).use(sinonChai);

describe('RunConfigServiceInstance', () => {
  let instance: RunConfigServiceInstance;
  const workspaceFolderName = 'runConfigServiceInstance-test';
  const workspaceFolderPath = path.join(tmpdir(), workspaceFolderName);
  const workspaceFolder = {
    uri: URI.file(workspaceFolderPath),
    index: 0,
    name: workspaceFolderName,
  };
  const mockProjectStateServiceInstance = {
    metadata: {
      language: {
        name: 'Java',
      },
    },
  } as unknown as ProjectStateServiceInstance;
  const mockExtensionState = {} as unknown as ExtensionState;
  const mockEventEmitter = new MockVSCode.EventEmitter<RunConfigServiceInstance>();

  beforeEach(() => {
    instance = new RunConfigServiceInstance(
      workspaceFolder,
      mockProjectStateServiceInstance,
      mockExtensionState,
      mockEventEmitter
    );
  });

  afterEach(() => {
    Sinon.restore();
  });

  describe('addMissingConfigs', () => {
    it('creates missing configs', async () => {
      Sinon.stub(instance, 'hasLaunchConfig').returns(false);
      Sinon.stub(instance, 'hasTestConfig').returns(false);

      const updateLaunchConfig = Sinon.spy(instance, 'updateLaunchConfig');
      const updateTestConfig = Sinon.spy(instance, 'updateTestConfig');

      await instance.addMissingConfigs();

      expect(updateLaunchConfig).to.have.been.calledOnce;
      expect(updateTestConfig).to.have.been.calledOnce;
    });

    it('does not update configs that already exist', async () => {
      Sinon.stub(instance, 'hasLaunchConfig').returns(false);
      Sinon.stub(instance, 'hasTestConfig').returns(true);

      const updateLaunchConfig = Sinon.spy(instance, 'updateLaunchConfig');
      const updateTestConfig = Sinon.spy(instance, 'updateTestConfig');

      await instance.addMissingConfigs();

      expect(updateLaunchConfig).to.have.been.calledOnce;
      expect(updateTestConfig).to.have.not.been.called;
    });
  });
});
