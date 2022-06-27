import * as vscode from 'vscode';
import { DEBUG_EXCEPTION, Telemetry } from '../telemetry';
import ErrorCode from '../telemetry/definitions/errorCodes';
import { ProcessWatcher } from './processWatcher';
import { WorkspaceServiceInstance } from './workspaceService';

export default class NodeProcessServiceInstance implements WorkspaceServiceInstance {
  disposables: vscode.Disposable[] = [];

  constructor(
    public folder: vscode.WorkspaceFolder,
    protected readonly processes: Readonly<ProcessWatcher[]>
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

      p.start();
    });
  }

  dispose(): void {
    this.processes.forEach((p) => p.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}
