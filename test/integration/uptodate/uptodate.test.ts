// @project project-uptodate
import assert from 'assert';
import * as vscode from 'vscode';
import { touch } from '../../../src/util';
import { initializeWorkspace, waitForExtension, waitForIndexer } from '../util';
import { UserFile, UserPageAppMapFile, waitForDependsUpdate } from './util';

describe('Uptodate', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(waitForIndexer);
  afterEach(initializeWorkspace);

  it('detects when the AppMap is up to date again', async () => {
    const uptodateService = await waitForDependsUpdate();
    assert.strictEqual(Object.keys(uptodateService.serviceInstances).length, 1);

    await touch(UserFile);
    await waitForDependsUpdate();

    assert.strictEqual(uptodateService.isUpToDate(vscode.Uri.file(UserPageAppMapFile)), false);

    await touch(UserPageAppMapFile);
    await waitForDependsUpdate();

    assert.strictEqual(uptodateService.isUpToDate(vscode.Uri.file(UserPageAppMapFile)), true);

    const outOfDateTestLocations = await uptodateService.outOfDateTestLocations();
    assert.deepStrictEqual(outOfDateTestLocations, []);
  });
});
