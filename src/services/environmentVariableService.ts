import * as vscode from 'vscode';

export default class EnvironmentVariableService implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private readonly timeoutPeriod = 60_000 * 3; // 3 minutes
  private timeout?: NodeJS.Timeout;

  constructor() {
    this.disposables.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('appMap.commandLineEnvironment')) {
          this.notifyEnvironmentChanged();
        }
      })
    );
  }

  private async notifyEnvironmentChanged(): Promise<void> {
    // If timeout is present, we can't send another notification.
    if (this.timeout) return;

    // Allow another notification to be sent after the timeout, assuming the configuration changes again.
    this.timeout = setTimeout(() => {
      this.timeout = undefined;
    }, this.timeoutPeriod);

    const res = await vscode.window.showInformationMessage(
      'Changes to the AppMap command line environment require a reload of the AppMap extension to apply. Reload now?',
      'Reload'
    );

    if (res === 'Reload') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  }

  dispose(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.disposables.forEach((d) => d.dispose());
  }
}
