import * as vscode from 'vscode';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { ProcessWatcher } from './processWatcher';
import { ProjectStateServiceInstance } from './projectStateService';
import { WorkspaceServiceInstance } from './workspaceService';

export default class NodeProcessServiceInstance implements WorkspaceServiceInstance {
  disposables: vscode.Disposable[] = [];
  jobInterval?: NodeJS.Timeout;

  constructor(
    public folder: vscode.WorkspaceFolder,
    protected readonly processes: Readonly<ProcessWatcher[]>,
    protected readonly projectState: ProjectStateServiceInstance
  ) {
    this.processes.forEach((p) => {
      this.disposables.push(
        p.onError((e) => {
          Telemetry.sendEvent(DEBUG_EXCEPTION, {
            exception: e,
            errorCode: ErrorCode.ProcessFailure,
            log: p.process?.log.toString(),
          });
        })
      );
    });
  }

  initialize(): void {
    this.startJob();
  }

  // By using a single interval to start/stop processes we avoid trying to do job control concurrently, which
  // leads to situations like attempts to start a process that is already running.
  protected async manageProcesses(): Promise<void> {
    const processControl = async (): Promise<void> => {
      for (let index = 0; index < this.processes.length; index++) {
        const process = this.processes[index];
        const { enabled, reason } = await process.canStart();
        if (enabled && !process.running) process.start();
        else if (!enabled && process.running) process.stop(reason);
      }
    };
    this.stopJob();
    try {
      await processControl();
    } finally {
      this.startJob();
    }
  }

  protected startJob(): void {
    if (this.jobInterval) return;

    this.jobInterval = setInterval(this.manageProcesses.bind(this), 1000);
  }

  protected stopJob(): void {
    if (this.jobInterval) clearInterval(this.jobInterval);

    this.jobInterval = undefined;
  }

  dispose(): void {
    this.stopJob();
    this.processes.forEach((p) => p.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
