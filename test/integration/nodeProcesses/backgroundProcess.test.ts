import assert from 'assert';
import { NodeProcessService } from '../../../src/services/nodeProcessService';
import NodeProcessServiceInstance from '../../../src/services/nodeProcessServiceInstance';
import { ProcessWatcher } from '../../../src/services/processWatcher';
import { WorkspaceServiceInstance } from '../../../src/services/workspaceService';
import { retry } from '../../../src/util';
import { initializeWorkspace, ProjectA, restoreFile, waitForExtension } from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';

async function waitForProcessState(
  processWatchers: ReadonlyArray<ProcessWatcher>,
  isRunning: boolean,
  pidExclusions: (number | undefined)[] // If a process is identified by a PID in `pidExclusions`, it will not pass the conditional,
): Promise<void> {
  await retry(
    () => {
      if (
        !processWatchers.every(
          (p) => p.running == isRunning && !pidExclusions.includes(p.process?.pid)
        )
      ) {
        throw new Error('Waiting for processes to start');
      }
    },
    5,
    1000
  );
}

const waitForUp = (
  processWatchers: ReadonlyArray<ProcessWatcher>,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processWatchers, true, pidExclusions);

const waitForDown = (
  processWatchers: ReadonlyArray<ProcessWatcher>,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processWatchers, false, pidExclusions);

describe('Background processes', () => {
  let processService: NodeProcessService;
  let processServiceInstance: NodeProcessServiceInstance;
  let processWatchers: ReadonlyArray<ProcessWatcher>;

  beforeEach(initializeWorkspace);
  beforeEach(async () => {
    const extension = await waitForExtension();
    processService = extension.processService;
    assert.ok(processService, 'the service exists');

    if (!processService.ready) {
      await new Promise<void>((resolve): void => {
        const disposable = processService?.onReady((): void => {
          disposable?.dispose();
          resolve();
        });
      });
    }

    let serviceInstances: WorkspaceServiceInstance[] = [];
    await retry(
      () => {
        serviceInstances = extension.workspaceServices.getServiceInstances(processService);
        if (serviceInstances.length === 0) {
          throw new Error(`Waiting for service instance creation`);
        }
      },
      5,
      1000
    );

    assert.strictEqual(serviceInstances.length, 1, 'a single service instance exists');

    processServiceInstance = serviceInstances[0] as NodeProcessServiceInstance;
    processWatchers = processServiceInstance['processes'];
  });

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

  it('process state reflects the presence of appmap.yml', async () => {
    await waitForUp(processWatchers);
    const originalPids = processWatchers.map((p) => p.process?.pid);
    assert.ok(originalPids.every((pid) => pid !== undefined));

    await fs.unlink(path.join(ProjectA, 'appmap.yml'));
    await waitForDown(processWatchers);

    await restoreFile('appmap.yml', ProjectA);
    await waitForUp(processWatchers, originalPids);
  });
});
