// @project project-uptodate
import assert from 'assert';
import * as vscode from 'vscode';
import { touch } from '../../../src/lib/touch';
import { initializeWorkspace, waitForExtension, waitForIndexer } from '../util';
import { UserFile, UserPageAppMapFile, waitForDependsUpdate } from './util';

describe('Uptodate', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(waitForIndexer);
  afterEach(initializeWorkspace);

  it('detects when the AppMap is out of date', async () => {
    const uptodateService = await waitForDependsUpdate();
    assert.strictEqual(Object.keys(uptodateService.serviceInstances).length, 1);

    await touch(UserFile);
    await waitForDependsUpdate();

    assert.strictEqual(uptodateService.isUpToDate(vscode.Uri.file(UserPageAppMapFile)), false);

    const outOfDateTestLocations = await uptodateService.outOfDateTestLocations();
    assert.deepStrictEqual(outOfDateTestLocations, ['spec/requests/user_spec.rb:10']);
  });
});
