import * as vscode from 'vscode';

import RpcProcessService from './rpcProcessService';

export default class EnvironmentVariableService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private debounce?: NodeJS.Timeout;
  private restarting = false;

  constructor(private rpcService: RpcProcessService) {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('appMap.commandLineEnvironment')) {
          this.scheduleRestart();
        }
      })
    );
  }

  private scheduleRestart() {
    if (this.debounce) {
      this.debounce.refresh();
    } else {
      this.debounce = setTimeout(() => this.restartRpcServer(), 5000);
    }
  }

  private restartRpcServer(): void {
    // if we're restarting now, schedule another restart
    // since the user is obviously still mucking with the env
    if (this.restarting) this.scheduleRestart();
    else {
      this.debounce = undefined;
      this.restarting = true;
      this.rpcService.restart().finally(() => (this.restarting = false));
    }
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
