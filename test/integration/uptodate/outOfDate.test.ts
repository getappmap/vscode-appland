// @project project-uptodate
import assert from 'assert';
import * as vscode from 'vscode';
import { touch } from '../../../src/lib/touch';
import {
  closeWorkspace,
  initializeWorkspace,
  repeatUntil,
  waitForExtension,
  waitForIndexer,
} from '../util';
import { UserFile, UserPageAppMapFile, waitForDependsUpdate } from './util';

describe('Uptodate', () => {
  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(waitForIndexer);
  afterEach(closeWorkspace);

  it('detects when the AppMap is out of date', async () => {
    const uptodateService = await waitForDependsUpdate();
    const serviceInstances = (await waitForExtension()).workspaceServices.getServiceInstances(
      uptodateService
    );
    assert.strictEqual(serviceInstances.length, 1);

    await repeatUntil(
      () => touch(UserFile),
      `${UserPageAppMapFile} is still considered up to date`,
      () => !uptodateService.isUpToDate(vscode.Uri.file(UserPageAppMapFile))
    );

    const outOfDateTestLocations = await uptodateService.outOfDateTestLocations();
    assert.deepStrictEqual(outOfDateTestLocations, ['spec/requests/user_spec.rb:10']);
  });
});
