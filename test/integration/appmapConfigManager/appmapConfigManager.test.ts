// @project project-monorepo

import * as vscode from 'vscode';
import { SinonSandbox, createSandbox } from 'sinon';
import { dirname, join } from 'path';
import { waitFor, waitForExtension } from '../util';
import {
  AppmapConfig,
  AppmapConfigManagerInstance,
} from '../../../src/services/appmapConfigManager';
import assert from 'assert';
import { appendFile, rm, unlink, writeFile } from 'fs/promises';
import { existsSync } from 'fs';

const projectMonorepo = join(process.cwd(), 'test', 'fixtures', 'workspaces', 'project-monorepo');
const sortByConfigFolder = (a: AppmapConfig, b: AppmapConfig): number =>
  a.configFolder.localeCompare(b.configFolder);

const getConfigManagerInstance = async (): Promise<AppmapConfigManagerInstance> => {
  const { workspaceServices, configManager } = await waitForExtension();
  const configManagerInstances = workspaceServices.getServiceInstances(configManager);
  assert.strictEqual(configManagerInstances.length, 1);
  return configManagerInstances[0];
};

const removeAppmapDirs = async (
  configManagerInstance: AppmapConfigManagerInstance
): Promise<void> => {
  await Promise.all(
    configManagerInstance.workspaceConfigs.map(async (config) => {
      // NOTE: this assumes a two-level appmapDir like tmp/appmap or fake/dir
      try {
        await rm(dirname(join(config.configFolder, config.appmapDir)), { recursive: true });
      } catch (e) {
        console.warn(e);
      }
    })
  );
};

const expectedProjectConfigs = [
  {
    appmapDir: 'fake/dir',
    configFolder: join(projectMonorepo, 'sub-a'),
    usingDefault: false,
  },
  {
    appmapDir: 'tmp/appmap',
    configFolder: join(projectMonorepo, 'sub-b'),
    usingDefault: true,
  },
  {
    appmapDir: 'tmp/appmap',
    configFolder: join(projectMonorepo, 'sub-c'),
    usingDefault: true,
  },
];

describe('appmapConfigWatcher', () => {
  let sinon: SinonSandbox;
  let configManagerInstance: AppmapConfigManagerInstance;

  beforeEach(async () => {
    configManagerInstance = await getConfigManagerInstance();
    sinon = createSandbox();
  });

  afterEach(async () => {
    await removeAppmapDirs(configManagerInstance);
    sinon.restore();
  });

  it('creates directories for appmap-dir', async () => {
    await waitFor('directory to be created', async () =>
      existsSync(join(projectMonorepo, 'sub-a', 'fake', 'dir'))
    );

    assert(existsSync(join(projectMonorepo, 'sub-a', 'fake', 'dir')));
    ['sub-b', 'sub-c'].forEach((subDirName) => {
      assert(existsSync(join(projectMonorepo, subDirName, 'tmp', 'appmap')));
    });
    assert(!existsSync(join(projectMonorepo, 'sub-d', 'tmp', 'appmap')));
  });

  it('correctly reports that it is not using a default config', () => {
    assert(!configManagerInstance.isUsingDefaultConfig);
  });

  it('correctly reports that there is a config file', () => {
    assert(configManagerInstance.hasConfigFile);
  });

  it('generates the correct config files', () => {
    const expected = expectedProjectConfigs.sort(sortByConfigFolder);
    const actual = configManagerInstance.workspaceConfigs.sort(sortByConfigFolder);
    assert.deepEqual(actual, expected);
  });

  it('allows the user to pick a sub-repo folder when providing an appmap config', async () => {
    const quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
    quickPickStub.resolves(join(projectMonorepo, 'sub-c') as unknown as vscode.QuickPickItem);

    const retrievedConfig = await configManagerInstance.getAppmapConfig();
    const expected = {
      appmapDir: 'tmp/appmap',
      configFolder: join(projectMonorepo, 'sub-c'),
      usingDefault: true,
    };

    assert.deepEqual(retrievedConfig, expected);
    assert(quickPickStub.calledOnce);
  });

  it('detects a new blank config file', async () => {
    const filePath = join(projectMonorepo, 'sub-d', 'appmap.yml');
    await writeFile(filePath, '');
    await waitFor(
      'configManager to create a new config',
      async () => configManagerInstance.workspaceConfigs.length === 4
    );

    const expected = expectedProjectConfigs.slice();
    expected.push({
      appmapDir: 'tmp/appmap',
      configFolder: join(projectMonorepo, 'sub-d'),
      usingDefault: true,
    });

    assert.deepEqual(
      configManagerInstance.workspaceConfigs.sort(sortByConfigFolder),
      expected.sort(sortByConfigFolder)
    );

    await unlink(filePath);
  });

  it('detects a modified config file', async () => {
    await appendFile(join(projectMonorepo, 'sub-b', 'appmap.yml'), 'appmap_dir: new/one');
    await waitFor('update to configs', () =>
      configManagerInstance.workspaceConfigs.some((config) => config.appmapDir === 'new/one')
    );

    const expected = expectedProjectConfigs.slice();
    expected.map((config) => {
      if (config.configFolder.includes('sub-b')) {
        config.appmapDir = 'new/one';
        config.usingDefault = false;
      }
      return config;
    });

    assert.deepEqual(
      configManagerInstance.workspaceConfigs.sort(sortByConfigFolder),
      expected.sort(sortByConfigFolder)
    );

    await writeFile(join(projectMonorepo, 'sub-b', 'appmap.yml'), '');
  });
});
