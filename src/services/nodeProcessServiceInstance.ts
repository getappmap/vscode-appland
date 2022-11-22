import * as vscode from 'vscode';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import ProjectMetadata from '../workspace/projectMetadata';
import AnalysisManager from './analysisManager';
import { ProcessWatcher } from './processWatcher';
import { ProjectStateServiceInstance } from './projectStateService';
import { WorkspaceServiceInstance } from './workspaceService';

export default class NodeProcessServiceInstance implements WorkspaceServiceInstance {
  disposables: vscode.Disposable[] = [];
  protected running = false;
  protected agentInstalled = false;

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

  protected onReceiveProjectMetadata(metadata: Readonly<ProjectMetadata>): void {
    this.agentInstalled = Boolean(metadata.agentInstalled);
    this.agentInstalled
      ? this.start()
      : this.stop(undefined, 'appmap.yml has been deleted or moved');
  }

  initialize(): void {
    const metadata = this.projectState.metadata;
    this.onReceiveProjectMetadata(metadata);
    this.disposables.push(
      this.projectState.onStateChange((metadata) => this.onReceiveProjectMetadata(metadata)),
      AnalysisManager.onAnalysisToggled(({ enabled }) => {
        enabled ? this.start('analysis') : this.stop('analysis', 'analysis has been disabled');
      })
    );
  }

  start(id?: string): void {
    if (!this.agentInstalled) return;

    this.processes
      .filter((process) => !process.running && (!id || id === process.id))
      .forEach((process) => {
        process.start();
      });
  }

  stop(id?: string, reason?: string): void {
    this.processes
      .filter((process) => !id || id === process.id)
      .forEach((process) => {
        process.stop(reason);
      });
  }

  dispose(): void {
    this.processes.forEach((p) => p.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
