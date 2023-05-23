import assert from 'assert';
import { AllProcessIds, ProcessId } from '../../../src/services/processWatcher';
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
import { waitForDown, waitForUp, getBackgroundProcesses } from './util';

describe('Background processes', () => {
  withAuthenticatedUser();

  context('monitoring appmap.yml', () => {
    beforeEach(initializeWorkspace);
    afterEach(initializeWorkspace);

    it('handles appmap.yml creation after start', async () => {
      const configFile = path.join(ProjectA, 'appmap.yml');
      console.log(`unlinking ${configFile}`);

      await fs.unlink(configFile);
      await waitFor(`${configFile} still exists`, async () => !(await fileExists(configFile)));

      await restoreFile('appmap.yml', ProjectA);
      await waitForUp();
    });

    it('process state reflects the presence of appmap.yml', async () => {
      await waitForUp();

      const originalPids = Object.values(await getBackgroundProcesses()).map((p) => p.process?.pid);
      assert.ok(originalPids.every((pid) => pid !== undefined));

      await fs.unlink(path.join(ProjectA, 'appmap.yml'));
      await waitForDown();

      await restoreFile('appmap.yml', ProjectA);
      await waitForUp(AllProcessIds, originalPids);
    });
  });

  context('with processes initialized', () => {
    beforeEach(initializeWorkspace);
    beforeEach(getBackgroundProcesses);

    afterEach(initializeWorkspace);

    it('automatically runs background processes', async () => {
      await waitForUp();

      const waitSeconds = 10;
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));

      assert.ok(
        Object.values(await getBackgroundProcesses()).every((p) => p.running && p.crashCount === 0),
        `background processes have not crashed after ${waitSeconds}s`
      );
    });

    it('restores crashed processes', async () => {
      await waitForUp();

      const backgroundProcesses = Object.values(await getBackgroundProcesses());
      const pids = backgroundProcesses.map((p) => p.process?.pid);

      assert.ok(pids.every((pid) => pid !== undefined));
      assert.ok(
        backgroundProcesses.map((p) => p.process?.kill()).every((killed) => killed),
        'every process is killed'
      );

      await waitForUp(AllProcessIds, pids);

      const newPids = Object.values(await getBackgroundProcesses()).map((p) => p.process?.pid);
      assert.ok(newPids.every((pid) => pid !== undefined));
    });

    it('analysis process state reflects whether or not analysis is enabled', async () => {
      await waitForUp();

      const analysisService = (await getBackgroundProcesses()).analysis;
      assert(analysisService);
      const analysisPid = analysisService.process?.pid;
      assert(analysisPid);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', false);
      await waitForDown([ProcessId.Analysis]);

      vscode.workspace.getConfiguration('appMap').update('findingsEnabled', true);
      await waitForUp([ProcessId.Analysis], [analysisPid]);
    });

    it('specifies --appmap-dir', async () => {
      await waitForUp();
      Object.values(await getBackgroundProcesses())
        .map((p) => p.options.args?.join(' ') || ' ')
        .forEach((cmd) => {
          assert(cmd.includes('--appmap-dir tmp/appmap'));
        });
    });

    it('inherits identity from the extension host', async () => {
      await waitForUp();
      const processes = await getBackgroundProcesses();
      Object.values(processes)
        .map((p) => p.options.env)
        .forEach((env) => {
          assert(env?.APPMAP_SESSION_ID === vscode.env.sessionId);
          assert(env?.APPMAP_USER_ID === vscode.env.machineId);
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
    });

    afterEach(initializeWorkspace);

    it('spawns background processes with updated --appmap-dir', async () => {
      await waitFor('Processes should pick up the change to appmap_dir', async () =>
        Object.values(await getBackgroundProcesses())
          .map((p) => p.options.args?.join(' ') || ' ')
          .every((cmd) => {
            console.log('COMMAND: ', cmd);
            return cmd.includes(`--appmap-dir ${appmapDir}`);
          })
      );
    });

    it("creates the AppMap directory if it doesn't already exist", async () => {
      await waitFor(
        `appmap_dir ${appmapDir} should be created`,
        async () => await fileExists(expectedPath)
      );
    });
  });
});
