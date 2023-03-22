import { ProcessWatcher } from '../../../src/services/processWatcher';
import { retry } from '../../../src/util';
import assert from 'assert';
import NodeProcessServiceInstance from '../../../src/services/nodeProcessServiceInstance';
import { WorkspaceServiceInstance } from '../../../src/services/workspaceService';
import { waitForExtension } from '../util';
import { NodeProcessService } from '../../../src/services/nodeProcessService';

async function waitForProcessState(
  processWatchers: ReadonlyArray<ProcessWatcher>,
  isRunning: boolean,
  pidExclusions: (number | undefined)[], // If a process is identified by a PID in `pidExclusions`, it will not pass the conditional,
  action: string
): Promise<void> {
  await retry(
    () => {
      if (
        !processWatchers.every(
          (p) => p.running == isRunning && !pidExclusions.includes(p.process?.pid)
        )
      ) {
        throw new Error(`Waiting for processes to ${action}`);
      }
    },
    15,
    1000
  );
}

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export const waitForUp = (
  processWatchers: ReadonlyArray<ProcessWatcher>,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processWatchers, true, pidExclusions, 'start');

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export const waitForDown = (
  processWatchers: ReadonlyArray<ProcessWatcher>,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processWatchers, false, pidExclusions, 'shut down');

export interface InitializedProcessService {
  processService: NodeProcessService;
  processServiceInstance: NodeProcessServiceInstance;
  processWatchers: ReadonlyArray<ProcessWatcher>;
}

export async function initializeProcesses(): Promise<ReadonlyArray<ProcessWatcher>> {
  const extension = await waitForExtension();
  const processService = extension.processService;
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

  const processServiceInstance = serviceInstances[0] as NodeProcessServiceInstance;
  return processServiceInstance['processes'];
}
