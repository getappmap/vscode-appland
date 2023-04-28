import assert from 'assert';
import { ProcessWatcher } from '../../../src/services/processWatcher';
import { fileExists } from '../../../src/util';
import {
  initializeWorkspace,
  ProjectA,
  restoreFile,
  waitFor,
  withAuthenticatedUser,
} from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { waitForDown, waitForUp, initializeProcesses as getProcessWatchers } from './util';

describe('Background processes', () => {
  withAuthenticatedUser();

  let processWatchers: ReadonlyArray<ProcessWatcher>;
  const initializeProcesses = async () => {
    processWatchers = await getProcessWatchers();
  };

  context('monitoring appmap.yml', () => {
    beforeEach(initializeWorkspace);
    afterEach(initializeWorkspace);

    it('handles appmap.yml creation after start', async () => {
      const configFile = path.join(ProjectA, 'appmap.yml');
      console.log(`unlinking ${configFile}`);

      await fs.unlink(configFile);
      assert(!(await fileExists(configFile)));

      await initializeProcesses();

      await restoreFile('appmap.yml', ProjectA);
      await waitForUp(processWatchers);
    });

    it('process state reflects the presence of appmap.yml', async () => {
      await initializeProcesses();
      await waitForUp(processWatchers);
      const originalPids = processWatchers.map((p) => p.process?.pid);
      assert.ok(originalPids.every((pid) => pid !== undefined));

      await fs.unlink(path.join(ProjectA, 'appmap.yml'));
      await waitForDown(processWatchers);

      await restoreFile('appmap.yml', ProjectA);
      await waitForUp(processWatchers, originalPids);
    });
  });

  context('with processes initialized', () => {
    beforeEach(initializeWorkspace);

    beforeEach(initializeProcesses);

    afterEach(initializeWorkspace);

    it('automatically runs background processes', async () => {
      await waitForUp(processWatchers);

      const waitSeconds = 10;
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

      assert.ok(
        processWatchers.every((p) => p.running && p['crashCount'] === 0),
        `background processes have not crashed after ${waitSeconds}s`
      );
    });

    it('restores crashed processes', async () => {
      await waitForUp(processWatchers);

      const pids = processWatchers.map((p) => p.process?.pid);
      assert.ok(pids.every((pid) => pid !== undefined));

      assert.ok(
        processWatchers.map((p) => p.process?.kill()).every((killed) => killed),
        'every process is killed'
      );

      await waitForUp(processWatchers, pids);

      const newPids = processWatchers.map((p) => p.process?.pid);
      assert.ok(newPids.every((pid) => pid !== undefined));
    });

    it('analysis process state reflects whether or not analysis is enabled', async () => {
      await waitForUp(processWatchers);

      const analysisService = processWatchers.find((p) => p.id === 'analysis');
      const analysisPid = analysisService?.process?.pid;
      assert(analysisService);
      assert(analysisPid);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', false);
      await waitForDown([analysisService]);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
      await waitForUp([analysisService], [analysisPid]);
    });

    it('specifies --appmap-dir', async () => {
      await waitForUp(processWatchers);
      processWatchers
        .map((p) => p['options'].args?.join(' ') || ' ')
        .forEach((cmd) => {
          assert(cmd.includes('--appmap-dir tmp/appmap'));
        });
    });
  });

  context('with appmap_dir specified in appmap.yml', () => {
    const appmapDir = 'fake/appmap';
    const configFile = path.join(ProjectA, 'appmap.yml');
    const expectedPath = path.join(ProjectA, appmapDir);

    beforeEach(async () => {
      await initializeWorkspace();
      assert(!(await fileExists(expectedPath)), 'the appmap_dir provided should not yet exist');
      await fs.appendFile(configFile, `\nappmap_dir: ${appmapDir}`);
      await initializeProcesses();
      await waitFor('appmap_dir being created', async () => await fileExists(expectedPath));
    });

    afterEach(async () => await initializeWorkspace());

    it('specifies --appmap-dir', async () => {
      // wait for new processes to spawn after change to appmap.yml
      await initializeProcesses();

      waitFor('Processes pick up the change to appmap_dir', async () =>
        processWatchers
          .map((p) => p['options'].args?.join(' ') || ' ')
          .every((cmd) => {
            console.log('COMMAND: ', cmd);
            return cmd.includes(`--appmap-dir ${appmapDir}`);
          })
      );
    });

    it("creates the AppMap directory if it doesn't already exist", async () => {
      assert(await fileExists(expectedPath), 'the appmap_dir provided does not exist');
    });
  });
});
