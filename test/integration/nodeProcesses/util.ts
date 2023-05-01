import * as vscode from 'vscode';
import assert from 'assert';
import NodeProcessServiceInstance from '../../../src/services/nodeProcessServiceInstance';
import { WorkspaceServiceInstance } from '../../../src/services/workspaceService';
import { waitFor, waitForExtension } from '../util';
import { AllProcessIds, ProcessId, ProcessWatcher } from '../../../src/services/processWatcher';

export type ProcessWatchers = { [key in ProcessId]: ProcessWatcher };

async function waitForProcessState(
  processIds: ReadonlyArray<ProcessId> = [ProcessId.Index, ProcessId.Analysis],
  isRunning: boolean,
  pidExclusions: (number | undefined)[], // If a process is identified by a PID in `pidExclusions`, it will not pass the conditional,
  action: string
): Promise<void> {
  await waitFor(`Background processes should ${action}`, async () =>
    Object.values(await getBackgroundProcesses())
      .filter((process) => processIds.includes(process.id))
      .every((p) => p.running == isRunning && !pidExclusions.includes(p.process?.pid))
  );
}

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export const waitForUp = (
  processIds: ProcessId[] = AllProcessIds,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processIds, true, pidExclusions, 'start');

/* eslint-disable-next-line @typescript-eslint/naming-convention */
export const waitForDown = (
  processIds: ReadonlyArray<ProcessId> = [ProcessId.Index, ProcessId.Analysis],
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processIds, false, pidExclusions, 'shut down');

export async function getBackgroundProcesses(): Promise<ProcessWatchers> {
  const extension = await waitForExtension();
  const processService = extension.processService;
  assert.ok(processService, 'the service exists');

  let serviceInstances: WorkspaceServiceInstance[] = [];
  await waitFor(
    `${vscode.workspace.workspaceFolders?.length} service instances should be created`,
    () => {
      serviceInstances = extension.workspaceServices.getServiceInstances(processService);
      return serviceInstances.length === vscode.workspace.workspaceFolders?.length;
    }
  );

  // assert(
  //   serviceInstances[0] instanceof NodeProcessServiceInstance,
  //   `${serviceInstances[0]} is not a NodeProcessServiceInstance`
  // );

  return (serviceInstances[0] as NodeProcessServiceInstance).processes.reduce(
    (acc, processWatcher) => ((acc[processWatcher.id] = processWatcher), acc),
    {} as ProcessWatchers
  );
}
