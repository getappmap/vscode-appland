import * as vscode from 'vscode';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import ProjectMetadata from '../workspace/projectMetadata';
import { ProcessWatcher } from './processWatcher';
import { ProjectStateServiceInstance } from './projectStateService';
import { WorkspaceServiceInstance } from './workspaceService';

export default class NodeProcessServiceInstance implements WorkspaceServiceInstance {
  disposables: vscode.Disposable[] = [];
  protected running = false;

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
          });
        })
      );
    });
  }

  protected onReceiveProjectMetadata(metadata: Readonly<ProjectMetadata>): void {
    metadata.agentInstalled ? this.start() : this.stop('appmap.yml has been deleted or moved');
  }

  async initialize(): Promise<void> {
    const metadata = await this.projectState.metadata();
    this.onReceiveProjectMetadata(metadata);
    this.disposables.push(
      this.projectState.onStateChange((metadata) => this.onReceiveProjectMetadata(metadata))
    );
  }

  start(): void {
    this.processes
      .filter((process) => !process.running)
      .forEach((process) => {
        process.start();
      });
  }

  stop(reason?: string): void {
    this.processes.forEach((process) => {
      process.stop(reason);
    });
  }

  dispose(): void {
    this.processes.forEach((p) => p.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}