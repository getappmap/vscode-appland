// @project project-base
// Use a different project because project-a has scannerEnabled: true setting
import assert from 'assert';
import { initializeWorkspace, waitForExtension, withAuthenticatedUser } from '../util';
import ExtensionSettings from '../../../src/configuration/extensionSettings';
import { getBackgroundProcesses } from '../nodeProcesses/util';
import { ProcessId } from '../../../src/services/processWatcher';

describe('Scanner', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  afterEach(initializeWorkspace);

  it('is turned off by default', async () => {
    assert.strictEqual(ExtensionSettings.scannerEnabled, false);

    const processes = await getBackgroundProcesses();
    assert(!Object.keys(processes).includes(ProcessId.Analysis));
  });
});
