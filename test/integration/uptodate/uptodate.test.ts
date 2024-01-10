// @project project-uptodate
import assert from 'assert';
import * as vscode from 'vscode';
import { touch } from '../../../src/lib/touch';
import {
  initializeWorkspace,
  repeatUntil,
  waitFor,
  waitForExtension,
  waitForIndexer,
  withAuthenticatedUser,
} from '../util';
import { UserFile, UserPageAppMapFile, waitForDependsUpdate } from './util';

describe('Uptodate', () => {
  withAuthenticatedUser();

  beforeEach(initializeWorkspace);
  beforeEach(waitForExtension);
  beforeEach(waitForIndexer);
  afterEach(initializeWorkspace);

  it('detects when the AppMap is up to date again', async () => {
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

    await repeatUntil(
      () => touch(UserPageAppMapFile),
      `${UserPageAppMapFile} is not yet considered up to date`,
      () => uptodateService.isUpToDate(vscode.Uri.file(UserPageAppMapFile))
    );

    await waitFor(
      `Out of date test locations is not empty`,
      async () => (await uptodateService.outOfDateTestLocations()).length === 0
    );
  });
});
