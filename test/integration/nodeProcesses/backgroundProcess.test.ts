import assert from 'assert';
import { NodeProcessService } from '../../../src/services/nodeProcessService';
import NodeProcessServiceInstance from '../../../src/services/nodeProcessServiceInstance';
import { ProcessWatcher } from '../../../src/services/processWatcher';
import { WorkspaceServiceInstance } from '../../../src/services/workspaceService';
import { retry } from '../../../src/util';
import {
  initializeWorkspace,
  ProjectA,
  restoreFile,
  unsafeCast,
  waitForExtension,
  withAuthenticatedUser,
  withTmpDir,
} from '../util';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectStateServiceInstance } from '../../../src/services/projectStateService';
import Sinon from 'sinon';

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

const waitForUp = (
  processWatchers: ReadonlyArray<ProcessWatcher>,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processWatchers, true, pidExclusions, 'start');

const waitForDown = (
  processWatchers: ReadonlyArray<ProcessWatcher>,
  pidExclusions: (number | undefined)[] = []
): Promise<void> => waitForProcessState(processWatchers, false, pidExclusions, 'shut down');

describe('Background processes', () => {
  withAuthenticatedUser();

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
        assert(cmd.includes('--appmap-dir .'));
      });
  });

  context('with appmap_dir specified in appmap.yml', () => {
    it('specifies --appmap-dir', async () => {
      await withTmpDir(async (tmpDir) => {
        const uri = vscode.Uri.parse(tmpDir);
        const folder = {
          uri,
          name: path.basename(tmpDir),
          index: -1,
        } as vscode.WorkspaceFolder;
        const service = new NodeProcessService(
          {
            globalStorageUri: uri,
            extensionPath: path.join(__dirname, '..', '..', '..', '..'),
          } as vscode.ExtensionContext,
          [
            unsafeCast<ProjectStateServiceInstance>({
              folder,
              metadata: {},
              onStateChange: Sinon.stub(),
            }),
          ]
        );
        await fs.writeFile(path.join(tmpDir, 'appmap.yml'), 'appmap_dir: example', 'utf8');
        const instance = await service.create(folder);
        instance['processes']
          .map((p) => p['options'].args?.join(' ') || ' ')
          .forEach((cmd) => {
            assert(cmd.includes('--appmap-dir example'));
          });
      });
    });
  });
});
